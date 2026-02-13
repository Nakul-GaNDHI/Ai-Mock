/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuth } from "@clerk/clerk-react";
import {
  CircleStop,
  Loader,
  Mic,
  RefreshCw,
  Save,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import useSpeechToText from "react-hook-speech-to-text";
import type { ResultType } from "react-hook-speech-to-text";
import { useParams } from "react-router-dom";
import { TooltipButton } from "./tooltip-button";
import { toast } from "sonner";
import { chatSession } from "@/scripts";
import { SaveModal } from "./save-modal";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase.config";
import ProctoringCamera from "@/components/proctoringCamera";

// record-answer.tsx
interface RecordAnswerProps {
  question: { question: string; answer: string };
  onSubmit: (answer: string) => void; // ✅ Correct type
}

interface AIResponse {
  ratings: number;
  feedback: string;
}

export const RecordAnswer = ({
  question,
  onSubmit,
}: RecordAnswerProps) => {
  const {
    interimResult,
    isRecording,
    results,
    startSpeechToText,
    stopSpeechToText,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
  });

  const [userAnswer, setUserAnswer] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const MIN_RECORD_TIME = 30;
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { userId } = useAuth();
  const { interviewId } = useParams();

  // ===== Start / Stop Recording =====
  const recordUserAnswer = async () => {
    if (isRecording) {
      stopSpeechToText();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (recordingTime < MIN_RECORD_TIME) {
        toast.error(`Minimum ${MIN_RECORD_TIME} seconds recording required`);
        return;
      }

      if (userAnswer.trim().length < 30) {
        toast.error("Your answer should be more than 30 characters");
        return;
      }

      const result = await generateResult(
        question.question,
        question.answer,
        userAnswer
      );

      setAiResult(result);
    } else {
      setUserAnswer("");
      setAiResult(null);
      setRecordingTime(0);

      startSpeechToText();

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  // ===== AI Feedback =====
  const generateResult = async (
    qst: string,
    qstAns: string,
    userAns: string
  ): Promise<AIResponse> => {
    setIsAiGenerating(true);

    const prompt = `
Question: "${qst}"
User Answer: "${userAns}"
Correct Answer: "${qstAns}"
Give rating (1-10) and feedback.
Return JSON with fields "ratings" and "feedback".
`;

    try {
      const aiRes = await chatSession.sendMessage(prompt);
      const text = aiRes.response.text().replace(/(json|```|`)/g, "").trim();
      return JSON.parse(text);
    } catch {
      toast.error("Error generating feedback");
      return { ratings: 0, feedback: "Unable to generate feedback" };
    } finally {
      setIsAiGenerating(false);
    }
  };

  // ===== Save Answer =====
  const saveUserAnswer = async () => {
    if (!aiResult || recordingTime < MIN_RECORD_TIME) {
      toast.error("Complete minimum recording first");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "userAnswers"), {
        mockIdRef: interviewId,
        question: question.question,
        correct_ans: question.answer,
        user_ans: userAnswer,
        feedback: aiResult.feedback,
        rating: aiResult.ratings,
        userId,
        attemptAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      toast.success("Answer saved");

      setUserAnswer("");
      setAiResult(null);
      setRecordingTime(0);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      stopSpeechToText();
      setOpen(false);

      setTimeout(() => {
        onSubmit(userAnswer);
      }, 300);
    } catch {
      toast.error("Error saving answer");
    } finally {
      setLoading(false);
    }
  };

  // ===== Combine Speech (Final + Live) =====
  useEffect(() => {
    const transcript = results
      .filter((r): r is ResultType => typeof r !== "string")
      .map((r) => r.transcript)
      .join(" ");

    setUserAnswer((transcript + " " + interimResult).trim());
  }, [results, interimResult]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-8 mt-4">
      <SaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={saveUserAnswer}
        loading={loading}
      />

      <div className="flex items-center justify-center gap-3">
        <TooltipButton
          content={isRecording ? "Stop Recording" : "Start Recording"}
          icon={isRecording ? <CircleStop /> : <Mic />}
          onClick={recordUserAnswer}
        />

        <TooltipButton
          content="Record Again"
          icon={<RefreshCw />}
          onClick={recordUserAnswer}
        />

        <TooltipButton
          content="Save Result"
          icon={
            isAiGenerating ? (
              <Loader className="animate-spin" />
            ) : (
              <Save />
            )
          }
          onClick={() => setOpen(true)}
          disabled={!aiResult || recordingTime < MIN_RECORD_TIME}
        />
      </div>

      <div className="w-full mt-4 p-4 border rounded-md bg-gray-50">
        <h2 className="text-lg font-semibold">Your Answer:</h2>
        <p className="text-sm mt-2 text-gray-700">
          {userAnswer || "Start recording to see your answer here"}
        </p>
      </div>

      {/* ✅ Always ON Proctoring Camera */}
      <div className="w-full h-[300px] md:w-96 flex items-center justify-center border p-2 bg-gray-50 rounded-md">
        <ProctoringCamera />
      </div>
    </div>
  );
};