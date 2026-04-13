import { Module } from "@nestjs/common";

import { ReviewsController } from "./reviews.controller";

@Module({ controllers: [ReviewsController] })
export class ReviewsModule {}
