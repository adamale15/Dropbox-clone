"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Divider } from "@heroui/divider";
import {
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { signUpSchema } from "@/schemas/signUpSchema";

export default function SignUpForm() {
  const router = useRouter();
  const { signUp, isLoaded, setActive } = useSignUp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check if sign-up attempt is still valid when in verification mode
  useEffect(() => {
    if (verifying && (!isLoaded || !signUp || !signUp.id)) {
      setVerifying(false);
      setAuthError("Sign-up session expired. Please try again.");
    }
  }, [verifying, isLoaded, signUp]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof signUpSchema>) => {
    if (!isLoaded) return;

    setIsSubmitting(true);
    setAuthError(null);

    try {
      const result = await signUp.create({
        emailAddress: data.email,
        password: data.password,
      });

      // Verify that sign-up was created successfully
      if (!result || !result.id) {
        throw new Error("Failed to create sign-up attempt");
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      
      // Double-check signUp still exists before switching to verification view
      if (signUp && signUp.id) {
        setVerifying(true);
        setAuthError(null);
      } else {
        throw new Error("Sign-up attempt was lost");
      }
    } catch (error: any) {
      console.error("Sign-up error:", error);
      setAuthError(
        error.errors?.[0]?.message ||
          error.message ||
          "An error occurred during sign-up. Please try again."
      );
      setVerifying(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!isLoaded || !signUp) {
      setVerificationError(
        "Sign-up session expired. Please start over."
      );
      setVerifying(false);
      return;
    }

    // Check if sign-up attempt exists
    if (!signUp.id) {
      setVerificationError(
        "Sign-up attempt not found. Please start over."
      );
      setVerifying(false);
      return;
    }

    setIsSubmitting(true);
    setVerificationError(null);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/dashboard");
      } else {
        console.error("Verification incomplete:", result);
        setVerificationError(
          "Verification could not be completed. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      const errorMessage = error.errors?.[0]?.message || 
        error.message || 
        "An error occurred during verification. Please try again.";
      
      // If the error indicates no sign-up attempt, reset to sign-up form
      if (errorMessage.includes("No sign up attempt") || 
          errorMessage.includes("sign up attempt was not found")) {
        setVerificationError("Session expired. Please start over.");
        setVerifying(false);
      } else {
        setVerificationError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if we should show verification form - ensure signUp exists and has an id
  if (verifying) {
    // If signUp is not available or doesn't have an id, show error message
    if (!isLoaded || !signUp || !signUp.id) {
      return (
        <Card className="w-full max-w-md border border-default-200 bg-default-50 shadow-xl">
          <CardHeader className="flex flex-col gap-1 items-center pb-2">
            <h1 className="text-2xl font-bold text-default-900">
              Session Expired
            </h1>
          </CardHeader>
          <Divider />
          <CardBody className="py-6">
            <div className="bg-danger-50 text-danger-700 p-4 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>Sign-up session expired. Please start over.</p>
            </div>
            <Button
              color="primary"
              className="w-full"
              onClick={() => {
                setVerifying(false);
                setAuthError(null);
                setVerificationCode("");
              }}
            >
              Back to Sign Up
            </Button>
          </CardBody>
        </Card>
      );
    }

    return (
      <Card className="w-full max-w-md border border-default-200 bg-default-50 shadow-xl">
        <CardHeader className="flex flex-col gap-1 items-center pb-2">
          <h1 className="text-2xl font-bold text-default-900">
            Verify Your Email
          </h1>
          <p className="text-default-500 text-center">
            We've sent a verification code to your email
          </p>
        </CardHeader>

        <Divider />

        <CardBody className="py-6">
          {verificationError && (
            <div className="bg-danger-50 text-danger-700 p-4 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{verificationError}</p>
            </div>
          )}

          <form
            onSubmit={handleVerificationSubmit}
            className="space-y-6"
            suppressHydrationWarning
          >
            <div className="space-y-2">
              <label
                htmlFor="verificationCode"
                className="text-sm font-medium text-default-900"
              >
                Verification Code
              </label>
              <Input
                id="verificationCode"
                type="text"
                placeholder="Enter the 6-digit code"
                value={verificationCode}
                onChange={(e: any) => setVerificationCode(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={isSubmitting}
            >
              {isSubmitting ? "Verifying..." : "Verify Email"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-default-500">
              Didn't receive a code?{" "}
              <button
                type="button"
                onClick={async () => {
                  if (!signUp || !signUp.id) {
                    setVerificationError("Sign-up session expired. Please start over.");
                    setVerifying(false);
                    return;
                  }
                  try {
                    await signUp.prepareEmailAddressVerification({
                      strategy: "email_code",
                    });
                    setVerificationError(null);
                  } catch (error: any) {
                    console.error("Resend error:", error);
                    setVerificationError(
                      error.errors?.[0]?.message ||
                        "Failed to resend code. Please try again."
                    );
                  }
                }}
                className="text-primary hover:underline font-medium"
              >
                Resend code
              </button>
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setVerifying(false);
                  setVerificationCode("");
                  setVerificationError(null);
                }}
                className="text-sm text-default-500 hover:text-default-700 underline"
              >
                Back to sign up
              </button>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border border-default-200 bg-default-50 shadow-xl">
      <CardHeader className="flex flex-col gap-1 items-center pb-2">
        <h1 className="text-2xl font-bold text-default-900">
          Create Your Account
        </h1>
        <p className="text-default-500 text-center">
          Sign up to start managing your images securely
        </p>
      </CardHeader>

      <Divider />

      <CardBody className="py-6">
        {authError && (
          <div className="bg-danger-50 text-danger-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{authError}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
          suppressHydrationWarning
        >
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-default-900"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              startContent={<Mail className="h-4 w-4 text-default-500" />}
              isInvalid={!!errors.email}
              errorMessage={errors.email?.message}
              {...register("email")}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-default-900"
            >
              Password
            </label>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              startContent={<Lock className="h-4 w-4 text-default-500" />}
              endContent={
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-default-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-default-500" />
                  )}
                </Button>
              }
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
              {...register("password")}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="passwordConfirmation"
              className="text-sm font-medium text-default-900"
            >
              Confirm Password
            </label>
            <Input
              id="passwordConfirmation"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              startContent={<Lock className="h-4 w-4 text-default-500" />}
              endContent={
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  type="button"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-default-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-default-500" />
                  )}
                </Button>
              }
              isInvalid={!!errors.passwordConfirmation}
              errorMessage={errors.passwordConfirmation?.message}
              {...register("passwordConfirmation")}
              className="w-full"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-default-600">
                By signing up, you agree to our Terms of Service and Privacy
                Policy
              </p>
            </div>
          </div>

          {/* Clerk CAPTCHA widget */}
          <div id="clerk-captcha" />

          <Button
            type="submit"
            color="primary"
            className="w-full"
            isLoading={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </CardBody>

      <Divider />

      <CardFooter className="flex justify-center py-4">
        <p className="text-sm text-default-600">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
