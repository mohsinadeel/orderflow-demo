import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class OrderFlowThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const requestContext = GqlExecutionContext.create(context).getContext();
      return { req: requestContext.req, res: requestContext.res };
    }
    return super.getRequestResponse(context);
  }
}
