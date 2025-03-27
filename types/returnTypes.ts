// For login Action Return type
export type LoginActionState = {
  errors?: {
    message?: string[];
  };
  redirectTo?: string;
};

export type ActionsReturnTypes = {
  error: {
    message?: string;
  };
  success: boolean;
};
