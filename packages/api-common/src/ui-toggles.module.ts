import { FEATURE_TOGGLE_KEYS } from "@clinic/shared-types";
import { Controller, Get, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "./prisma.service";
import { UiTogglesResponseDto } from "./swagger-response.dto";

export interface UiToggles {
	showFooterLogo: boolean;
	appointmentTimezoneBug: boolean;
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
		const toggles = await this.prisma.featureToggle
			.findMany({
				where: { key: { in: [FEATURE_TOGGLE_KEYS.SHOW_FOOTER_LOGO, FEATURE_TOGGLE_KEYS.APPOINTMENT_TIMEZONE] } },
			})
			.catch(() => []);
		const isEnabled = (key: string): boolean => toggles.find(t => t.key === key)?.enabled ?? false;
		return {
			data: {
				showFooterLogo: isEnabled(FEATURE_TOGGLE_KEYS.SHOW_FOOTER_LOGO),
				appointmentTimezoneBug: isEnabled(FEATURE_TOGGLE_KEYS.APPOINTMENT_TIMEZONE),
			},
		};
	}
}

@Module({
	controllers: [UiTogglesController],
})
export class UiTogglesModule {}
