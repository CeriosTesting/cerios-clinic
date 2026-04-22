import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	SetMetadata,
	createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";

export interface KeycloakTokenPayload {
	sub: string;
	email: string;
	given_name: string;
	family_name: string;
	realm_access?: { roles: string[] };
}

export const IS_PUBLIC_KEY = "isPublic";

export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) return true;
		return super.canActivate(context);
	}
}

export const ROLES_KEY = "roles";

export const Roles = (...roles: string[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
		if (!requiredRoles?.length) return true;

		const user = context.switchToHttp().getRequest().user as KeycloakTokenPayload;
		const roles = user?.realm_access?.roles ?? [];
		if (!requiredRoles.some(r => roles.includes(r))) {
			throw new ForbiddenException("Insufficient role");
		}
		return true;
	}
}

export const CurrentUser = createParamDecorator(
	(_: unknown, ctx: ExecutionContext): KeycloakTokenPayload =>
		ctx.switchToHttp().getRequest().user as KeycloakTokenPayload
);
