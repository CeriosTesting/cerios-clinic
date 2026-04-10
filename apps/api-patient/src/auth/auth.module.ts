import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { KeycloakAdminService } from "./keycloak-admin.service";

@Module({
	imports: [PassportModule.register({ defaultStrategy: "jwt" })],
	providers: [JwtStrategy, KeycloakAdminService],
	controllers: [AuthController],
	exports: [PassportModule],
})
export class AuthModule {}
