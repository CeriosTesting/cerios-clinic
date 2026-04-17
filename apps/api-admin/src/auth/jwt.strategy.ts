import { KeycloakTokenPayload } from "@clinic/api-common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import * as jwksRsa from "jwks-rsa";
import { ExtractJwt, Strategy } from "passport-jwt";

import { getApiRuntimeEnv } from "../config/env";

export type { KeycloakTokenPayload };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
		const env = getApiRuntimeEnv();

		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKeyProvider: jwksRsa.passportJwtSecret({
				cache: true,
				rateLimit: true,
				jwksRequestsPerMinute: 5,
				jwksUri: env.keycloak.jwksUri,
			}),
			issuer: env.keycloak.issuer,
			audience: env.keycloak.audience,
			algorithms: ["RS256"],
		});
	}

	validate(payload: KeycloakTokenPayload): KeycloakTokenPayload {
		const roles = payload.realm_access?.roles ?? [];
		if (!roles.includes("admin")) {
			throw new UnauthorizedException("Admin role required");
		}
		return payload;
	}
}
