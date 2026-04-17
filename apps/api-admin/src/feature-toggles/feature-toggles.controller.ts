import { Controller, Get, Put, Param, Body, UseGuards, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { IsBoolean, IsOptional, IsObject } from "class-validator";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { FeatureTogglesService } from "./feature-toggles.service";

class UpdateToggleDto {
	@IsOptional() @IsBoolean() enabled?: boolean;
	@IsOptional() @IsObject() config?: Prisma.InputJsonValue;
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
	async list() {
		const toggles = await this.service.findAll();
		return { data: toggles };
	}

	@Get(":key")
	@ApiOperation({ summary: "Get a feature toggle by key" })
	async get(@Param("key") key: string) {
		const toggle = await this.service.findByKey(key);
		return { data: toggle };
	}

	@Put(":key")
	@ApiOperation({ summary: "Update a feature toggle" })
	async update(@Param("key") key: string, @Body() dto: UpdateToggleDto) {
		const toggle = await this.service.upsert(key, dto);
		return { data: toggle };
	}

	@Post("seed")
	@ApiOperation({ summary: "Seed default feature toggles" })
	async seed() {
		await this.service.seed();
		return { message: "Feature toggles seeded" };
	}
}
