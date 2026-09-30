// DPDP Act 2023 feature: consent gate, privacy self-service, public pages, admin console.
export { default as ConsentGate } from './components/ConsentGate';
export { default as PrivacyCenter } from './components/privacy/PrivacyCenter';
export { default as DataProtectionAdmin } from './components/admin/DataProtectionAdmin';
export { default as PublicPrivacyPage } from './components/public/PublicPrivacyPage';
export { default as GuardianConsentPage } from './components/public/GuardianConsentPage';
export { dpdpService } from './services/dpdp.service';
export { useDpdpAccess, DPDP_MANAGE_PERMISSION } from './hooks/useDpdpAccess';
export { onConsentRequired, emitConsentRequired, isConsentRequiredError, installConsentInterceptor } from './lib/consentEvents';
export * from './types';
