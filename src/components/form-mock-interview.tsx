import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  type SubmitHandler,
} from "react-hook-form";

import type { Interview } from "@/types";
import { CustomBreadCrumb } from "./custom-bread-crumb";
import { Headings } from "./headings";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Loader, Trash2 } from "lucide-react";

import { chatSession } from "@/scripts";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase.config";

/* --------------------------------------------------
   Schema
-------------------------------------------------- */
const formSchema = z.object({
  position: z.string().min(1, "Position is required").max(100),
  description: z.string().min(10, "Description is required"),
  experience: z.number().min(0, "Experience must be 0 or more"),
  techStack: z.string().min(1, "Tech stack is required"),
});

type FormData = z.infer<typeof formSchema>;

interface FormMockInterviewProps {
  initialData: Interview | null;
}

/* --------------------------------------------------
   Component
-------------------------------------------------- */
export const FormMockInterview = ({
  initialData,
}: FormMockInterviewProps) => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);

  /* --------------------------------------------------
     Form Setup (FIXED defaultValues)
  -------------------------------------------------- */
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      position: initialData?.position ?? "",
      description: initialData?.description ?? "",
      experience: initialData?.experience ?? 0,
      techStack: initialData?.techStack ?? "",
    },
    mode: "onChange",
  });

  const { isValid, isSubmitting } = form.formState;

  /* --------------------------------------------------
     Reset when editing
  -------------------------------------------------- */
  useEffect(() => {
    if (initialData) {
      form.reset({
        position: initialData.position,
        description: initialData.description,
        experience: initialData.experience,
        techStack: initialData.techStack,
      });
    }
  }, [initialData, form]);

  /* --------------------------------------------------
     Clean AI JSON
  -------------------------------------------------- */
  const cleanAiResponse = (text: string) => {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new Error("Invalid AI response");
    }
    return JSON.parse(text.slice(start, end + 1));
  };

  /* --------------------------------------------------
     Generate AI Questions
  -------------------------------------------------- */
  const generateQuestions = async (data: FormData) => {
    const prompt = `
Generate 5 technical interview questions and answers.

Return ONLY valid JSON array.
Format:
[
 { "question": "...", "answer": "..." }
]

Position: ${data.position}
Description: ${data.description}
Experience: ${data.experience} years
Tech Stack: ${data.techStack}
`;

    const result = await chatSession.sendMessage(prompt);
    return cleanAiResponse(result.response.text());
  };

  /* --------------------------------------------------
     Submit
  -------------------------------------------------- */
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!userId) {
      toast.error("Please login first");
      navigate("/sign-in");
      return;
    }

    try {
      setLoading(true);
      toast("Generating AI questions...");

      const questions = await generateQuestions(data);

      if (initialData) {
        await updateDoc(doc(db, "interviews", initialData.id), {
          ...data,
          questions,
          updatedAt: serverTimestamp(),
        });
        toast.success("Interview updated");
      } else {
        await addDoc(collection(db, "interviews"), {
          ...data,
          userId,
          questions,
          createdAt: serverTimestamp(),
        });
        toast.success("Interview created");
      }

      navigate("/generate");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
     Delete Interview
  -------------------------------------------------- */
  const handleDelete = async () => {
    if (!initialData) return;

    if (!confirm("Delete this interview?")) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "interviews", initialData.id));
      toast.success("Interview deleted");
      navigate("/generate");
    } catch (error) {
      console.error(error);
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */
  const title = initialData
    ? initialData.position
    : "Create a new mock interview";

  const actionText = initialData ? "Save Changes" : "Create";

  return (
    <div className="w-full flex-col space-y-4">
      <CustomBreadCrumb
        breadCrumbPage={initialData ? initialData.position : "Create"}
        breadCrumbItems={[
          { label: "Mock Interviews", link: "/generate" },
        ]}
      />

      <div className="flex items-center justify-between">
        <Headings title={title} isSubHeading />

        {initialData && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="text-red-500" />
          </Button>
        )}
      </div>

      <Separator />

      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="p-8 shadow-md rounded-lg flex flex-col gap-6"
        >
          {/* Position */}
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Position</FormLabel>
                <FormControl>
                  <Input disabled={loading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description</FormLabel>
                <FormControl>
                  <Textarea disabled={loading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Experience */}
          <FormField
            control={form.control}
            name="experience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience (Years)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    disabled={loading}
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tech Stack */}
          <FormField
            control={form.control}
            name="techStack"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tech Stack</FormLabel>
                <FormControl>
                  <Textarea disabled={loading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-4">
            <Button
              type="reset"
              variant="outline"
              disabled={loading || isSubmitting}
            >
              Reset
            </Button>

            <Button
              type="submit"
              disabled={!isValid || loading || isSubmitting}
            >
              {loading ? (
                <Loader className="animate-spin" />
              ) : (
                actionText
              )}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
