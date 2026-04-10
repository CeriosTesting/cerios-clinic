import { Module } from "@nestjs/common";

import { DoctorsController } from "./doctors.controller";

@Module({ controllers: [DoctorsController] })
export class DoctorsModule {}
