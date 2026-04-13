import { Module } from "@nestjs/common";

import { AvailabilityController } from "./availability.controller";

@Module({ controllers: [AvailabilityController] })
export class AvailabilityModule {}
