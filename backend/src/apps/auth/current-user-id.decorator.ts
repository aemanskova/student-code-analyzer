import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";

type AuthenticatedRequest = {
  user?: {
    sub?: number | string;
  };
};

export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const userId = Number(request.user?.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new UnauthorizedException("Invalid token payload");
  }
  return userId;
});
