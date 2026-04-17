import { Module } from "@nestjs/common";

import { FeatureTogglesController } from "./feature-toggles.controller";
import { FeatureTogglesService } from "./feature-toggles.service";

@Module({
	controllers: [FeatureTogglesController],
	providers: [FeatureTogglesService],
	exports: [FeatureTogglesService],
})
export class FeatureTogglesModule {}
