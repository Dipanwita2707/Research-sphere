import http from 'k6/http';
import exec from 'k6/execution';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5001/api/v1').replace(/\/$/, '');
const DEFAULT_USERNAME = __ENV.USERNAME || 'STU123456789';
const DEFAULT_PASSWORD = __ENV.PASSWORD || 'student123';
const FLOW = (__ENV.FLOW || 'browse').toLowerCase();
const EVENT_ID = __ENV.EVENT_ID || '';
const PAGE_LIMIT = Number(__ENV.PAGE_LIMIT || 20);
const THINK_TIME = Number(__ENV.THINK_TIME || 1);
const REGISTER_MODE = (__ENV.REGISTER_MODE || 'basic').toLowerCase();
const REGISTER_FORM_JSON = __ENV.REGISTER_FORM_JSON || '{}';
const TOKENS_JSON = __ENV.TOKENS_JSON || '';
const USER_TOKENS_FILE = __ENV.USER_TOKENS_FILE || '';

const tokenPool = loadTokenPool();

const flowErrors = new Counter('event_flow_errors');
const failedRequests = new Rate('failed_requests');
const loginDuration = new Trend('login_duration', true);
const eventListDuration = new Trend('event_list_duration', true);
const eventDetailDuration = new Trend('event_detail_duration', true);
const eventFormDuration = new Trend('event_form_duration', true);
const eventRegisterDuration = new Trend('event_register_duration', true);

export const options = buildOptions();

function buildOptions() {
  const executor = (__ENV.EXECUTOR || 'ramping-arrival-rate').toLowerCase();
  const baseOptions = {
    thresholds: {
      http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
      http_req_duration: [{ threshold: 'p(95)<3000', abortOnFail: false }],
      failed_requests: [{ threshold: 'rate<0.05', abortOnFail: false }],
      event_flow_errors: [{ threshold: 'count<50', abortOnFail: false }],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max', 'count'],
  };

  if (executor === 'constant-vus') {
    return {
      ...baseOptions,
      vus: Number(__ENV.VUS || 20),
      duration: __ENV.DURATION || '2m',
    };
  }

  if (executor === 'shared-iterations') {
    return {
      ...baseOptions,
      scenarios: {
        event_flow: {
          executor: 'shared-iterations',
          vus: Number(__ENV.VUS || 50),
          iterations: Number(__ENV.ITERATIONS || Math.max(tokenPool.length, 1)),
          maxDuration: __ENV.MAX_DURATION || '5m',
        },
      },
    };
  }

  return {
    ...baseOptions,
    scenarios: {
      event_flow: {
        executor: 'ramping-arrival-rate',
        startRate: Number(__ENV.START_RATE || 5),
        timeUnit: '1s',
        preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || 25),
        maxVUs: Number(__ENV.MAX_VUS || 200),
        stages: parseStages(__ENV.STAGES_JSON),
      },
    },
  };
}

function parseTokenPool(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      fail('TOKENS_JSON must be a JSON array');
    }

    return parsed
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry.token === 'string') {
          return entry.token;
        }

        return null;
      })
      .filter(Boolean);
  } catch (error) {
    fail(`Invalid TOKENS_JSON: ${error.message}`);
  }
}

function loadTokenPool() {
  if (USER_TOKENS_FILE) {
    const fileContents = open(USER_TOKENS_FILE);
    return parseTokenPool(fileContents);
  }

  return parseTokenPool(TOKENS_JSON);
}

function parseStages(stagesJson) {
  if (!stagesJson) {
    return [
      { target: 10, duration: '1m' },
      { target: 25, duration: '2m' },
      { target: 50, duration: '2m' },
      { target: 0, duration: '30s' },
    ];
  }

  try {
    const parsed = JSON.parse(stagesJson);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('STAGES_JSON must be a non-empty array');
    }
    return parsed;
  } catch (error) {
    fail(`Invalid STAGES_JSON: ${error.message}`);
  }
}

function buildHeaders(token, includeJson = false) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function parseJson(response, label) {
  try {
    return response.json();
  } catch (error) {
    fail(`${label} did not return valid JSON`);
  }
}

function safeParseJson(response) {
  try {
    return response.json();
  } catch (error) {
    return null;
  }
}

function trackFailure(response, ok) {
  const failed = !ok || response.status >= 400;
  failedRequests.add(failed);
  if (failed) {
    flowErrors.add(1);
  }
}

function login(username, password) {
  const payload = JSON.stringify({ username, password });
  const response = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'auth_login' },
  });

  loginDuration.add(response.timings.duration);

  const ok = check(response, {
    'login status is 200': (res) => res.status === 200,
    'login returned token': (res) => {
      const body = parseJson(res, 'Login response');
      return body.success === true && typeof body.token === 'string' && body.token.length > 20;
    },
  });

  trackFailure(response, ok);

  if (!ok) {
    fail(`Login failed with status ${response.status}: ${response.body}`);
  }

  const body = parseJson(response, 'Login response');
  return body.token;
}

function discoverEventId(token) {
  const params = {
    headers: buildHeaders(token),
    tags: { endpoint: 'event_list_setup' },
  };

  const publishedResponse = http.get(
    `${BASE_URL}/events?page=1&limit=5&status=published`,
    params,
  );

  eventListDuration.add(publishedResponse.timings.duration);

  const publishedBody = parseJson(publishedResponse, 'Published events response');
  const publishedEvents = publishedBody?.data?.events || [];
  if (publishedResponse.status === 200 && publishedEvents.length > 0) {
    return publishedEvents[0].id;
  }

  const fallbackResponse = http.get(
    `${BASE_URL}/events?page=1&limit=5`,
    params,
  );

  eventListDuration.add(fallbackResponse.timings.duration);

  const fallbackBody = parseJson(fallbackResponse, 'Events response');
  const fallbackEvents = fallbackBody?.data?.events || [];
  if (fallbackResponse.status === 200 && fallbackEvents.length > 0) {
    return fallbackEvents[0].id;
  }

  fail('No event found. Pass EVENT_ID explicitly or create at least one event before running k6.');
}

function fetchEventList(token) {
  const response = http.get(`${BASE_URL}/events?page=1&limit=${PAGE_LIMIT}`, {
    headers: buildHeaders(token),
    tags: { endpoint: 'event_list' },
  });

  eventListDuration.add(response.timings.duration);
  const body = safeParseJson(response);

  const ok = check(response, {
    'event list status is 200': (res) => res.status === 200,
    'event list returned array': () => body?.success === true && Array.isArray(body?.data?.events),
  });

  trackFailure(response, ok);

  return body || {};
}

function fetchEventDetail(token, eventId) {
  const response = http.get(`${BASE_URL}/events/${eventId}`, {
    headers: buildHeaders(token),
    tags: { endpoint: 'event_detail' },
  });

  eventDetailDuration.add(response.timings.duration);
  const body = safeParseJson(response);

  const ok = check(response, {
    'event detail status is 200': (res) => res.status === 200,
    'event detail returned data': () => body?.success === true && !!body?.data,
  });

  trackFailure(response, ok);
  return body || {};
}

function fetchRegistrationForm(token, eventId) {
  const response = http.get(`${BASE_URL}/events/${eventId}/registration-form`, {
    headers: buildHeaders(token),
    tags: { endpoint: 'event_registration_form' },
  });

  eventFormDuration.add(response.timings.duration);
  const body = safeParseJson(response);

  const ok = check(response, {
    'registration form status is 200': (res) => res.status === 200,
    'registration form returned success': () => body?.success === true,
  });

  trackFailure(response, ok);
  return body || {};
}

function registerForEvent(token, eventId) {
  let response;

  if (REGISTER_MODE === 'form') {
    response = http.post(`${BASE_URL}/events/${eventId}/register-with-form`, REGISTER_FORM_JSON, {
      headers: buildHeaders(token, true),
      tags: { endpoint: 'event_register_with_form' },
    });
  } else {
    response = http.post(`${BASE_URL}/events/${eventId}/register`, null, {
      headers: buildHeaders(token),
      tags: { endpoint: 'event_register_basic' },
    });
  }

  eventRegisterDuration.add(response.timings.duration);

  const body = safeParseJson(response);
  const duplicateRegistration = typeof body?.message === 'string' && /already registered/i.test(body.message);
  const ok = check(response, {
    'registration status is success or duplicate': (res) => res.status === 200 || res.status === 201 || duplicateRegistration,
    'registration response is valid': () => body?.success === true || duplicateRegistration,
  });

  trackFailure(response, ok);

  return { response, body, duplicateRegistration };
}

export function setup() {
  const token = tokenPool.length > 0 ? tokenPool[0] : login(DEFAULT_USERNAME, DEFAULT_PASSWORD);
  const eventId = EVENT_ID || discoverEventId(token);

  if (FLOW === 'register') {
    if (tokenPool.length === 0) {
      console.log('Register flow is using one authenticated user token. For realistic write-capacity testing, pass TOKENS_JSON with many pre-generated user tokens.');
    } else {
      console.log(`Register flow loaded ${tokenPool.length} pre-generated user tokens.`);
    }
  }

  return { token, eventId };
}

export default function (data) {
  const token = tokenPool.length > 0
    ? tokenPool[exec.scenario.iterationInTest % tokenPool.length]
    : data.token;
  const eventId = data.eventId;

  const listBody = fetchEventList(token);
  const discoveredEventId = listBody?.data?.events?.[0]?.id || eventId;
  fetchEventDetail(token, discoveredEventId);
  fetchRegistrationForm(token, discoveredEventId);

  if (FLOW === 'register') {
    registerForEvent(token, discoveredEventId);
  }

  if (THINK_TIME > 0) {
    sleep(THINK_TIME);
  }
}

// No custom handleSummary — k6 prints its built-in detailed summary automatically.
