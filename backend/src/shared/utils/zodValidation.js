const { ZodError } = require("zod");
const { ValidationError } = require("./AppError");
const { deepNormalizeStrings } = require("./sanitize");

function formatIssuePath(path) {
  if (!Array.isArray(path) || path.length === 0) return "request";

  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      return index === 0 ? segment : `.${segment}`;
    })
    .join("");
}

function humanizeIssueMessage(issue) {
  const raw = issue?.message || "Invalid input";

  // Keep custom/schema-authored messages as-is.
  if (!raw.startsWith("Invalid input: expected")) {
    return raw;
  }

  if (issue?.code === "invalid_type" && issue?.received === "undefined") {
    return "This field is required";
  }

  if (issue?.code === "invalid_type" && issue?.expected === "array") {
    return "Please select at least one option";
  }

  if (issue?.code === "invalid_type" && issue?.expected === "string") {
    return "Please enter valid text";
  }

  if (issue?.code === "invalid_type" && issue?.expected === "number") {
    return "Please enter a valid number";
  }

  return "Please enter a valid value";
}

function formatZodError(error) {
  return error.issues
    .map((issue) => {
      const path = formatIssuePath(issue.path);
      const message = humanizeIssueMessage(issue);
      return path === "request" ? message : `${path}: ${message}`;
    })
    .join("; ");
}

function formatZodFieldErrors(error) {
  const fieldErrors = {};

  for (const issue of error.issues || []) {
    const path = formatIssuePath(issue.path);
    if (!fieldErrors[path]) {
      fieldErrors[path] = humanizeIssueMessage(issue);
    }
  }

  return fieldErrors;
}

function validateRequest({ body, params, query } = {}) {
  return (req, _res, next) => {
    try {
      if (params) {
        req.params = params.parse(deepNormalizeStrings(req.params || {}));
      }

      if (query) {
        req.query = query.parse(deepNormalizeStrings(req.query || {}));
      }

      if (body) {
        req.body = body.parse(deepNormalizeStrings(req.body || {}));
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(
          formatZodError(error),
          formatZodFieldErrors(error),
        );
      }
      next(error);
    }
  };
}

module.exports = {
  formatZodError,
  formatZodFieldErrors,
  validateRequest,
};
