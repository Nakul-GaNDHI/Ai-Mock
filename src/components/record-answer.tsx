/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuth } from "@clerk/clerk-react";
import {
  CircleStop,
  Loader,
  Mic,
  RefreshCw,
  Save,
  Video,
  VideoOff,
  WebcamIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import useSpeechToText from "react-hook-speech-to-text";
import type { ResultType } from "react-hook-speech-to-text";
import { useParams } from "react-router-dom";
import { TooltipButton } from "./tooltip-button";
import { toast } from "sonner";
import { chatSession } from "@/scripts";
import { SaveModal } from "./save-modal";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase.config";

// ✅ Only Proctoring Camera
import ProctoringCamera from "@/components/proctoringCamera";

interface RecordAnswerProps {
  question: { question: string; answer: string };
  isWebCam: boolean;
  setIsWebCam: (value: boolean) => void;
}

interface AIResponse {
  ratings: number;
  feedback: string;
}

export const RecordAnswer = ({
  question,
  isWebCam,
  setIsWebCam,
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

  const { userId } = useAuth();
  const { interviewId } = useParams();

  // Start / Stop Recording
  const recordUserAnswer = async () => {
    if (isRecording) {
      stopSpeechToText();

      if (userAnswer?.length < 30) {
        toast.error("Error", {
          description: "Your answer should be more than 30 characters",
        });
        return;
      }

      const aiResult = await generateResult(
        question.question,
        question.answer,
        userAnswer
      );

      setAiResult(aiResult);
    } else {
      startSpeechToText();
    }
  };

  // Clean AI JSON
  const cleanJsonResponse = (responseText: string) => {
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/(json|```|`)/g, "");

    try {
      return JSON.parse(cleanText);
    } catch (error) {
      throw new Error("Invalid JSON format");
    }
  };

  // Generate AI feedback
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
      const aiResult = await chatSession.sendMessage(prompt);
      const parsedResult: AIResponse = cleanJsonResponse(
        aiResult.response.text()
      );
      return parsedResult;
    } catch (error) {
      toast("Error", {
        description: "Error generating feedback.",
      });
      return { ratings: 0, feedback: "Unable to generate feedback" };
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Record again
  const recordNewAnswer = () => {
    setUserAnswer("");
    stopSpeechToText();
    startSpeechToText();
  };

  // Save answer to Firebase
  const saveUserAnswer = async () => {
    setLoading(true);

    if (!aiResult) return;

    try {
      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("question", "==", question.question)
      );

      const querySnap = await getDocs(userAnswerQuery);

      if (!querySnap.empty) {
        toast.info("Already Answered", {
          description: "You have already answered this question",
        });
        return;
      }

      await addDoc(collection(db, "userAnswers"), {
        mockIdRef: interviewId,
        question: question.question,
        correct_ans: question.answer,
        user_ans: userAnswer,
        feedback: aiResult.feedback,
        rating: aiResult.ratings,
        userId,
        createdAt: serverTimestamp(),
      });

      toast("Saved", { description: "Your answer has been saved." });

      setUserAnswer("");
      stopSpeechToText();
    } catch (error) {
      toast("Error", { description: "Error saving answer." });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  // Combine speech results
  useEffect(() => {
    const combineTranscripts = results
      .filter((result): result is ResultType => typeof result !== "string")
      .map((result) => result.transcript)
      .join(" ");

    setUserAnswer(combineTranscripts);
  }, [results]);

return (
  <div className="w-full flex flex-col items-center gap-8 mt-4">
    <SaveModal
      isOpen={open}
      onClose={() => setOpen(false)}
      onConfirm={saveUserAnswer}
      loading={loading}
    />

    {/* Controls */}
    <div className="flex items-center justify-center gap-3">
      <TooltipButton
        content={isWebCam ? "Turn Off" : "Turn On"}
        icon={
          isWebCam ? (
            <VideoOff className="min-w-5 min-h-5" />
          ) : (
            <Video className="min-w-5 min-h-5" />
          )
        }
        onClick={() => setIsWebCam(!isWebCam)}
      />

      <TooltipButton
        content={isRecording ? "Stop Recording" : "Start Recording"}
        icon={
          isRecording ? (
            <CircleStop className="min-w-5 min-h-5" />
          ) : (
            <Mic className="min-w-5 min-h-5" />
          )
        }
        onClick={recordUserAnswer}
      />

      <TooltipButton
        content="Record Again"
        icon={<RefreshCw className="min-w-5 min-h-5" />}
        onClick={recordNewAnswer}
      />

      <TooltipButton
        content="Save Result"
        icon={
          isAiGenerating ? (
            <Loader className="min-w-5 min-h-5 animate-spin" />
          ) : (
            <Save className="min-w-5 min-h-5" />
          )
        }
        onClick={() => setOpen(true)}
        disbaled={!aiResult}
      />
    </div>

    {/* Answer Box */}
    <div className="w-full mt-4 p-4 border rounded-md bg-gray-50">
      <h2 className="text-lg font-semibold">Your Answer:</h2>
      <p className="text-sm mt-2 text-gray-700">
        {userAnswer || "Start recording to see your answer here"}
      </p>

      {interimResult && (
        <p className="text-sm text-gray-500 mt-2">
          <strong>Current Speech:</strong> {interimResult}
        </p>
      )}
    </div>

    {/* ✅ Proctoring Camera moved to Bottom */}
    <div className="w-full h-[300px] md:w-96 flex flex-col items-center justify-center border p-2 bg-gray-50 rounded-md">
      {isWebCam ? (
        <ProctoringCamera />
      ) : (
        <WebcamIcon className="min-w-24 min-h-24 text-muted-foreground" />
      )}
    </div>
  </div>
);
}