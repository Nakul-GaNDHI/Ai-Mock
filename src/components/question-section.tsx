import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TooltipButton } from "./tooltip-button";
import { Volume2, VolumeX } from "lucide-react";
import { RecordAnswer } from "./record-answer";

interface QuestionSectionProps {
  questions: { question: string; answer: string }[];
}

export const QuestionSection = ({ questions }: QuestionSectionProps) => {
  const navigate = useNavigate();

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);

  // 🔒 Track completed questions
  const [completedIndex, setCompletedIndex] = useState(-1);

  // 🆕 Store all answers
  const [allAnswers, setAllAnswers] = useState<{ question: string; answer: string }[]>([]);

  // 🔊 Speak question
  const speakQuestion = (text: string) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.onstart = () => {
      setIsPlaying(true);
      setShowQuestion(false);
    };

    speech.onend = () => {
      setIsPlaying(false);
      setShowQuestion(true);
    };

    window.speechSynthesis.speak(speech);
  };

  // Auto play when question changes
  useEffect(() => {
    if (!questions[activeIndex]) return;

    const timer = setTimeout(() => {
      speakQuestion(questions[activeIndex].question);
    }, 0);

    return () => clearTimeout(timer);
  }, [activeIndex, questions]);

  // Cleanup
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // 👉 Called after answer submit from RecordAnswer
  const handleNextQuestion = (answer: string) => {
    window.speechSynthesis.cancel();
    setShowQuestion(false);

    const currentAnswer = {
      question: questions[activeIndex].question,
      answer,
    };

    // Save answer
    setAllAnswers((prev) => [...prev, currentAnswer]);

    // ✅ Mark current question as completed
    setCompletedIndex(activeIndex);

    if (activeIndex < questions.length - 1) {
      // ✅ Automatically move to next question tab
      setActiveIndex((prev) => prev + 1);
      setShowQuestion(false);
    } else {
      // ✅ Last question completed → Go to Feedback with all answers
      navigate("/generate/feedback/demo", {
        state: { answers: [...allAnswers, currentAnswer] },
      });
    }
  };

  return (
    <div className="w-full min-h-96 border rounded-md p-4">
      <Tabs
        value={questions[activeIndex]?.question}
        className="w-full space-y-12"
        orientation="vertical"
      >
        {/* Question Numbers */}
        <TabsList className="bg-transparent w-full flex flex-wrap gap-4">
          {questions.map((_, i) => {
            // ✅ Show only tabs up to completedIndex + 1
            if (i > completedIndex + 1) return null;

            return (
              <TabsTrigger
                key={i}
                value={questions[i].question}
                className={cn(
                  "text-xs px-2",
                  i === activeIndex && "bg-emerald-200 shadow-md"
                )}
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setActiveIndex(i);
                  setShowQuestion(false);
                }}
              >
                {`Question #${i + 1}`}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Question Content */}
        {questions.map((tab, i) => (
          <TabsContent key={i} value={tab.question}>
            {showQuestion && i === activeIndex && (
              <p className="text-base text-left tracking-wide text-neutral-500">
                {tab.question}
              </p>
            )}

            {/* Replay / Stop */}
            <div className="w-full flex justify-end">
              <TooltipButton
                content={isPlaying ? "Stop" : "Replay"}
                icon={
                  isPlaying ? (
                    <VolumeX className="min-w-5 min-h-5 text-muted-foreground" />
                  ) : (
                    <Volume2 className="min-w-5 min-h-5 text-muted-foreground" />
                  )
                }
                onClick={() => {
                  if (isPlaying) {
                    window.speechSynthesis.cancel();
                    setIsPlaying(false);
                    setShowQuestion(true);
                  } else {
                    speakQuestion(tab.question);
                  }
                }}
              />
            </div>

            {/* Answer Section */}
            {i === activeIndex && showQuestion && (
              <>
                <RecordAnswer
                  question={tab}
                  onSubmit={(answer: string) => handleNextQuestion(answer)}
                />

                {/* Show button only on last question */}
                {activeIndex === questions.length - 1 && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() =>
                        navigate("/generate/feedback/demo", {
                          state: { answers: allAnswers },
                        })
                      }
                      className="px-4 py-2 bg-emerald-600 text-white rounded-md"
                    >
                      View Feedback
                    </button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
