// Options that are implemented but not launched yet. Their code stays in place
// (buttons, flows, API calls); the app just does not offer them, and the server
// refuses them too (auth UNLAUNCHED_SOCIAL_PROVIDERS, payment_methods
// UNLAUNCHED_PROVIDERS). Remove an entry here and there to launch it.
import type { MethodProvider, SocialProvider } from "./types";

export const HIDDEN_SOCIAL_PROVIDERS: ReadonlySet<SocialProvider> = new Set<SocialProvider>(["facebook"]);

export const HIDDEN_PAY_PROVIDERS: ReadonlySet<MethodProvider> = new Set<MethodProvider>(["toss_pay"]);

export const isSocialLaunched = (provider: SocialProvider): boolean => !HIDDEN_SOCIAL_PROVIDERS.has(provider);

export const isPayLaunched = (provider: MethodProvider): boolean => !HIDDEN_PAY_PROVIDERS.has(provider);
