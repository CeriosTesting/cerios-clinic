import { Injectable, Module, UnauthorizedException, type DynamicModule } from "@nestjs/common";
import { PassportModule, PassportStrategy } from "@nestjs/passport";
import * as jwksRsa from "jwks-rsa";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { KeycloakTokenPayload } from "./auth";
import type { KeycloakRuntimeConfig } from "./keycloak";

export interface JwtStrategyOptions {
	/** The realm role this service requires (e.g. "patient", "doctor"). */
	requiredRole: string;
	/** Resolved Keycloak runtime config (issuer, audience, jwksUri). */
	keycloak: KeycloakRuntimeConfig;
	/** Human-readable role name used in error messages. Defaults to capitalized requiredRole. */
	errorLabel?: string;
}

/**
 * Factory producing a Passport JWT strategy class configured for Keycloak.
 * Each API service invokes this with its required realm role; the returned
 * class validates the token signature via JWKS and asserts role membership.
 *
 * Returns a decorated class so NestJS can register it as a provider.
 */
export function createJwtStrategy(options: JwtStrategyOptions): new () => Strategy {
	const label = options.errorLabel ?? options.requiredRole.charAt(0).toUpperCase() + options.requiredRole.slice(1);

	@Injectable()
	class JwtStrategy extends PassportStrategy(Strategy) {
		constructor() {
			super({
				jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
				secretOrKeyProvider: jwksRsa.passportJwtSecret({
					cache: true,
					rateLimit: true,
					jwksRequestsPerMinute: 5,
					jwksUri: options.keycloak.jwksUri,
				}),
				issuer: options.keycloak.issuer,
				audience: options.keycloak.audience,
				algorithms: ["RS256"],
			});
		}

		validate(payload: KeycloakTokenPayload): KeycloakTokenPayload {
			const roles: string[] = payload.realm_access?.roles ?? [];
			if (!roles.includes(options.requiredRole)) {
				throw new UnauthorizedException(`${label} role required`);
			}
			return payload;
		}
	}

	return JwtStrategy as unknown as new () => Strategy;
}

export interface AuthModuleOptions extends JwtStrategyOptions {}

/**
 * Minimal dynamic auth module that wires Passport + a role-checked JWT strategy.
 *
 * Services that also need an auth controller / admin service (e.g. api-patient
 * for self-service registration) should build their own @Module that imports
 * this one and adds their additional providers/controllers.
 */
@Module({})
export class ClinicAuthModule {
	static forRoot(options: AuthModuleOptions): DynamicModule {
		const JwtStrategyClass = createJwtStrategy(options);
		return {
			module: ClinicAuthModule,
			imports: [PassportModule.register({ defaultStrategy: "jwt" })],
			providers: [JwtStrategyClass],
			exports: [PassportModule],
		};
	}
}
