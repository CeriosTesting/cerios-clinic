import { FeatureToggleDetailResponseDto, FeatureToggleListResponseDto, MessageResponseDto } from "@clinic/api-common";
import { Controller, Get, Put, Param, Body, UseGuards, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiPropertyOptional,
	ApiTags,
} from "@nestjs/swagger";
import { type FeatureToggle, Prisma } from "@prisma/client";
import { IsBoolean, IsOptional, IsObject } from "class-validator";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { FeatureTogglesService } from "./feature-toggles.service";

class UpdateToggleDto {
	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;
	@ApiPropertyOptional({ type: Object, additionalProperties: true, example: { rolloutPercentage: 50 } })
	@IsOptional()
	@IsObject()
	config?: Prisma.InputJsonValue;
}

@ApiTags("feature-toggles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("feature-toggles")
export class FeatureTogglesController {
	constructor(private readonly service: FeatureTogglesService) {}

	@Get()
	@ApiOperation({ summary: "List all feature toggles" })
	@ApiOkResponse({ type: FeatureToggleListResponseDto })
	async list(): Promise<{ data: FeatureToggle[] }> {
		const toggles = await this.service.findAll();
		return { data: toggles };
	}

	@Get(":key")
	@ApiOperation({ summary: "Get a feature toggle by key" })
	@ApiOkResponse({ type: FeatureToggleDetailResponseDto })
	async get(@Param("key") key: string): Promise<{ data: FeatureToggle }> {
		const toggle = await this.service.findByKey(key);
		return { data: toggle };
	}

	@Put(":key")
	@ApiOperation({ summary: "Update a feature toggle" })
	@ApiOkResponse({ type: FeatureToggleDetailResponseDto })
	async update(@Param("key") key: string, @Body() dto: UpdateToggleDto): Promise<{ data: FeatureToggle }> {
		const toggle = await this.service.upsert(key, dto);
		return { data: toggle };
	}

	@Post("seed")
	@ApiOperation({ summary: "Seed default feature toggles" })
	@ApiCreatedResponse({ type: MessageResponseDto })
	async seed(): Promise<{ message: string }> {
		await this.service.seed();
		return { message: "Feature toggles seeded" };
	}
}
