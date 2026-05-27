import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import { Controller, Get, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "./prisma.service";
import { UiTogglesResponseDto } from "./swagger-response.dto";

export interface UiToggles {
	showFooterLogo: boolean;
}

@ApiTags("ui-toggles")
@ApiBearerAuth()
@Controller("ui-toggles")
export class UiTogglesController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get UI-related feature toggle states for the current portal" })
	@ApiOkResponse({ type: UiTogglesResponseDto })
	async list(): Promise<{ data: UiToggles }> {
		const toggle = await this.prisma.featureToggle
			.findUnique({ where: { key: FEATURE_TOGGLE_KEYS.SHOW_FOOTER_LOGO } })
			.catch(() => null);
		return {
			data: {
				showFooterLogo: toggle?.enabled ?? false,
			},
		};
	}
}

@Module({
	controllers: [UiTogglesController],
})
export class UiTogglesModule {}
