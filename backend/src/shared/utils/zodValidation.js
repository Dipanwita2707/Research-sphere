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

function formatZodError(error) {
  return error.issues
    .map((issue) => {
      const path = formatIssuePath(issue.path);
      return path === "request" ? issue.message : `${path}: ${issue.message}`;
    })
    .join("; ");
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
        throw new ValidationError(formatZodError(error));
      }
      next(error);
    }
  };
}

module.exports = {
  formatZodError,
  validateRequest,
};
