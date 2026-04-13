import { Module } from "@nestjs/common";

import { PrescriptionsController } from "./prescriptions.controller";

@Module({ controllers: [PrescriptionsController] })
export class PrescriptionsModule {}
