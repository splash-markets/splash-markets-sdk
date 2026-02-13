// Custom error classes for better error handling and categorization

/**
 * Base class for all SDK validation errors
 */
export class SplashSDKError extends Error {
   constructor(message: string, public readonly parameter?: string, public readonly value?: unknown) {
      super(message);
      this.name = 'SplashSDKError';
      Object.setPrototypeOf(this, SplashSDKError.prototype);
   }

   /**
    * Get a formatted error message with context
    */
   getFormattedMessage(): string {
      if (this.parameter && this.value !== undefined) {
         return `${this.message} (parameter: ${this.parameter}, received: ${String(this.value)})`;
      } else if (this.parameter) {
         return `${this.message} (parameter: ${this.parameter})`;
      }
      return this.message;
   }
}

/**
 * Error thrown when a value is out of range
 */
export class ValidationRangeError extends SplashSDKError {
   constructor(
      message: string,
      parameter: string,
      value: unknown,
      public readonly min?: number | bigint,
      public readonly max?: number | bigint
   ) {
      super(message, parameter, value);
      this.name = 'ValidationRangeError';
      Object.setPrototypeOf(this, ValidationRangeError.prototype);
   }

   getFormattedMessage(): string {
      let base = super.getFormattedMessage();
      if (this.min !== undefined && this.max !== undefined) {
         base += ` (expected range: ${this.min} - ${this.max})`;
      } else if (this.min !== undefined) {
         base += ` (expected minimum: ${this.min})`;
      } else if (this.max !== undefined) {
         base += ` (expected maximum: ${this.max})`;
      }
      return base;
   }
}

/**
 * Error thrown when a required parameter is missing or null
 */
export class ValidationRequiredError extends SplashSDKError {
   constructor(message: string, parameter: string) {
      super(message, parameter);
      this.name = 'ValidationRequiredError';
      Object.setPrototypeOf(this, ValidationRequiredError.prototype);
   }
}

/**
 * Error thrown when a type validation fails
 */
export class ValidationTypeError extends SplashSDKError {
   constructor(message: string, parameter: string, value: unknown, public readonly expectedType: string) {
      super(message, parameter, value);
      this.name = 'ValidationTypeError';
      Object.setPrototypeOf(this, ValidationTypeError.prototype);
   }

   getFormattedMessage(): string {
      return `${super.getFormattedMessage()} (expected type: ${this.expectedType})`;
   }
}

/**
 * Error thrown when an account is not found on-chain
 */
export class AccountNotFoundError extends SplashSDKError {
   public readonly cause?: Error;

   constructor(message: string, public readonly address: string, cause?: Error) {
      super(message, 'address', address);
      this.name = 'AccountNotFoundError';
      this.cause = cause;
      Object.setPrototypeOf(this, AccountNotFoundError.prototype);
   }

   getFormattedMessage(): string {
      return `${super.getFormattedMessage()} (account: ${this.address})`;
   }
}

/**
 * Error thrown when an RPC call or network operation fails
 */
export class RpcError extends SplashSDKError {
   public readonly cause?: Error;

   constructor(message: string, public readonly operation: string, cause?: Error) {
      super(message, 'operation', operation);
      this.name = 'RpcError';
      this.cause = cause;
      Object.setPrototypeOf(this, RpcError.prototype);
   }

   getFormattedMessage(): string {
      const base = super.getFormattedMessage();
      return this.cause 
         ? `${base} (caused by: ${this.cause.message})`
         : base;
   }
}

/**
 * Error thrown when account data fails to decode (wrong format, corrupted data, wrong account type)
 */
export class DecodingError extends SplashSDKError {
   public readonly cause?: Error;

   constructor(message: string, public readonly address: string, cause?: Error) {
      super(message, 'address', address);
      this.name = 'DecodingError';
      this.cause = cause;
      Object.setPrototypeOf(this, DecodingError.prototype);
   }

   getFormattedMessage(): string {
      const base = super.getFormattedMessage();
      return this.cause 
         ? `${base} (caused by: ${this.cause.message})`
         : base;
   }
}

/**
 * Error thrown when an operation fails due to an invalid state or configuration
 */
export class OperationError extends SplashSDKError {
   public readonly cause?: Error;

   constructor(message: string, public readonly operation?: string, cause?: Error) {
      super(message, operation ? 'operation' : undefined, operation);
      this.name = 'OperationError';
      this.cause = cause;
      Object.setPrototypeOf(this, OperationError.prototype);
   }

   getFormattedMessage(): string {
      const base = super.getFormattedMessage();
      return this.cause 
         ? `${base} (caused by: ${this.cause.message})`
         : base;
   }
}

/**
 * Error thrown when an unexpected or unknown error occurs that doesn't fit into other categories
 */
export class UnknownError extends SplashSDKError {
   public readonly cause?: Error;

   constructor(message: string, public readonly operation?: string, cause?: Error) {
      super(message, operation ? 'operation' : undefined, operation);
      this.name = 'UnknownError';
      this.cause = cause;
      Object.setPrototypeOf(this, UnknownError.prototype);
   }

   getFormattedMessage(): string {
      const base = super.getFormattedMessage();
      return this.cause 
         ? `${base} (caused by: ${this.cause.message})`
         : base;
   }
}

