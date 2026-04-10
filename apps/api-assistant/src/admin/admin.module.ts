import { Module } from "@nestjs/common";

import { AdminController } from "./admin.controller";
import { KeycloakAdminService } from "./keycloak-admin.service";

@Module({ controllers: [AdminController], providers: [KeycloakAdminService] })
export class AdminModule {}
