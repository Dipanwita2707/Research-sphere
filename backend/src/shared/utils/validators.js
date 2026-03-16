// Validation utilities

const {
  sanitizeDigits,
  sanitizeEmail,
  sanitizePlainText,
  sanitizeRichText,
  sanitizeUrl,
} = require("./sanitize");

const isValidStudentRegNo = (regNo) => /^\d{9}$/.test(regNo);

const isValidStaffUID = (uid) => /^\d{5}$/.test(uid);

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitizeEmail(email));
};

const isValidPassword = (password) => {
  // Minimum 8 characters, at least one letter and one number
  return (
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password)
  );
};

const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return sanitizePlainText(input);
};

const sanitizeHtml = (html) => {
  if (typeof html !== "string") return html;
  return sanitizeRichText(html);
};

/**
 * Sanitize sponsors array (used by Noting and Event)
 * Supports both old format { name, amount, type, notes } and new advanced format
 */
const sanitizeSponsors = (sponsors) => {
  if (!Array.isArray(sponsors)) return [];

  return sponsors
    .filter((sponsor) => sponsor && typeof sponsor === "object")
    .map((sponsor) => {
      const name = sanitizePlainText(sponsor.name || "", { maxLength: 256 });
      if (!name) return null;

      if (sponsor.contributionType) {
        const contributionType = ["cash", "in_kind", "both"].includes(
          sponsor.contributionType,
        )
          ? sponsor.contributionType
          : "cash";
        const sponsorType = ["corporate", "individual", "organization", "other"].includes(
          sponsor.sponsorType,
        )
          ? sponsor.sponsorType
          : "corporate";
        const originSource = ["noting", "event"].includes(sponsor.originSource)
          ? sponsor.originSource
          : undefined;

        const sanitizedSponsor = {
          name,
          sponsorType,
          contactPerson: sanitizePlainText(sponsor.contactPerson || "", {
            maxLength: 256,
          }),
          designation: sanitizePlainText(sponsor.designation || "", {
            maxLength: 256,
          }),
          phone: sanitizeDigits(sponsor.phone || "", { maxLength: 15 }),
          email: sanitizeEmail(sponsor.email || ""),
          notes:
            sanitizePlainText(sponsor.notes || "", { maxLength: 2000 }) ||
            undefined,
          contributionType,
        };

        if (sponsor.id && typeof sponsor.id === "string") {
          sanitizedSponsor.id = sanitizePlainText(sponsor.id, { maxLength: 64 });
        }
        if (originSource) sanitizedSponsor.originSource = originSource;
        if (sponsor.savedAt) sanitizedSponsor.savedAt = sponsor.savedAt;
        if (
          sponsor.originalSnapshot &&
          typeof sponsor.originalSnapshot === "object"
        ) {
          sanitizedSponsor.originalSnapshot = sponsor.originalSnapshot;
        }

        if (contributionType === "cash" || contributionType === "both") {
          const cashAmount = Number(sponsor.cashAmount);
          sanitizedSponsor.cashAmount =
            !Number.isNaN(cashAmount) && cashAmount >= 0 ? cashAmount : 0;
          sanitizedSponsor.paymentStatus = [
            "received",
            "pending",
            "partial",
            "not_received",
          ].includes(sponsor.paymentStatus)
            ? sponsor.paymentStatus
            : "pending";

          if (
            sanitizedSponsor.paymentStatus === "pending" ||
            sanitizedSponsor.paymentStatus === "not_received"
          ) {
            sanitizedSponsor.paymentMethod = undefined;
            sanitizedSponsor.paymentMethodOtherLabel = undefined;
            sanitizedSponsor.transactionId = undefined;
            sanitizedSponsor.receipt = null;
          } else {
            sanitizedSponsor.paymentMethod = [
              "cash",
              "upi",
              "card",
              "net_banking",
              "other",
            ].includes(sponsor.paymentMethod)
              ? sponsor.paymentMethod
              : undefined;
            sanitizedSponsor.paymentMethodOtherLabel =
              sanitizedSponsor.paymentMethod === "other"
                ? sanitizePlainText(sponsor.paymentMethodOtherLabel || "", {
                    maxLength: 128,
                  }) || undefined
                : undefined;
            sanitizedSponsor.transactionId =
              sanitizePlainText(sponsor.transactionId || "", {
                maxLength: 256,
              }) || undefined;

            if (
              sponsor.receipt &&
              typeof sponsor.receipt === "object" &&
              typeof sponsor.receipt.filePath === "string" &&
              sponsor.receipt.filePath.trim()
            ) {
              sanitizedSponsor.receipt = {
                filePath: sanitizeUrl(sponsor.receipt.filePath, {
                  maxLength: 1024,
                }),
                fileName: sanitizePlainText(
                  sponsor.receipt.fileName || "receipt",
                  { maxLength: 256 },
                ),
              };
            } else {
              sanitizedSponsor.receipt = null;
            }
          }

          if (
            sponsor.cashAssignedTo &&
            typeof sponsor.cashAssignedTo === "object" &&
            sponsor.cashAssignedTo.id
          ) {
            sanitizedSponsor.cashAssignedTo = {
              id: sanitizePlainText(sponsor.cashAssignedTo.id, {
                maxLength: 64,
              }),
              uid: sanitizePlainText(sponsor.cashAssignedTo.uid || "", {
                maxLength: 64,
              }),
              displayName: sanitizePlainText(
                sponsor.cashAssignedTo.displayName || "",
                { maxLength: 256 },
              ),
              department: sponsor.cashAssignedTo.department
                ? sanitizePlainText(sponsor.cashAssignedTo.department, {
                    maxLength: 256,
                  })
                : undefined,
            };
          } else {
            sanitizedSponsor.cashAssignedTo = null;
          }
        }

        if (contributionType === "in_kind" || contributionType === "both") {
          sanitizedSponsor.inKindItems = Array.isArray(sponsor.inKindItems)
            ? sponsor.inKindItems
                .filter(
                  (item) =>
                    item &&
                    typeof item === "object" &&
                    sanitizePlainText(item.itemName || "", { maxLength: 256 }),
                )
                .map((item) => {
                  const quantity = Number(item.quantity);
                  const estimatedValue = Number(item.estimatedValue);
                  const deliveryStatus = [
                    "pending",
                    "received",
                    "not_received",
                  ].includes(item.deliveryStatus)
                    ? item.deliveryStatus
                    : "pending";

                  const sanitizedItem = {
                    itemName: sanitizePlainText(item.itemName || "", {
                      maxLength: 256,
                    }),
                    category:
                      sanitizePlainText(item.category || "", {
                        maxLength: 128,
                      }) || undefined,
                    quantity:
                      !Number.isNaN(quantity) && quantity >= 0 ? quantity : 0,
                    estimatedValue:
                      !Number.isNaN(estimatedValue) && estimatedValue >= 0
                        ? estimatedValue
                        : 0,
                    description:
                      sanitizePlainText(item.description || "", {
                        maxLength: 2000,
                      }) || undefined,
                    deliveryStatus,
                  };

                  if (
                    item.assignedTo &&
                    typeof item.assignedTo === "object" &&
                    item.assignedTo.id
                  ) {
                    sanitizedItem.assignedTo = {
                      id: sanitizePlainText(item.assignedTo.id, {
                        maxLength: 64,
                      }),
                      uid: sanitizePlainText(item.assignedTo.uid || "", {
                        maxLength: 64,
                      }),
                      displayName: sanitizePlainText(
                        item.assignedTo.displayName || "",
                        { maxLength: 256 },
                      ),
                      department: item.assignedTo.department
                        ? sanitizePlainText(item.assignedTo.department, {
                            maxLength: 256,
                          })
                        : undefined,
                    };
                  } else {
                    sanitizedItem.assignedTo = null;
                  }

                  return sanitizedItem;
                })
            : [];
        }

        return sanitizedSponsor;
      }

      const type = sponsor.type === "in_kind" ? "in_kind" : "cash";
      const notes =
        sponsor.notes != null
          ? sanitizePlainText(sponsor.notes, { maxLength: 2000 })
          : "";

      if (type === "cash") {
        const amount = Number(sponsor.amount);
        return {
          name,
          amount: !Number.isNaN(amount) && amount >= 0 ? amount : 0,
          type: "cash",
          notes: notes || undefined,
        };
      }

      return { name, amount: 0, type: "in_kind", notes: notes || undefined };
    })
    .filter(Boolean);
};

/** Mobile: exactly 10 digits (strips spaces/dashes before check) */
const isValidMobile = (mobile) => {
  if (!mobile || !String(mobile).trim()) return true;
  return sanitizeDigits(mobile).length === 10;
};

/** Basic URL validation */
const isValidUrl = (url) => {
  if (!url || !String(url).trim()) return true;
  try {
    const normalizedUrl = sanitizeUrl(url);
    const parsed = new URL(
      normalizedUrl.startsWith("http")
        ? normalizedUrl
        : `https://${normalizedUrl}`,
    );
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

module.exports = {
  isValidStudentRegNo,
  isValidStaffUID,
  isValidEmail,
  isValidPassword,
  sanitizeInput,
  sanitizeHtml,
  sanitizeSponsors,
  isValidMobile,
  isValidUrl,
};
