import { useEffect } from "react";

export const useAgent = () => {
  useEffect(() => {
    // Initialize agent when component mounts
    const initializeAgent = async () => {
      try {
        await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "initialize" }),
        });
      } catch (error) {
        console.error("Failed to initialize agent:", error);
      }
    };

    initializeAgent();

    // Cleanup agent when component unmounts
    return () => {
      fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "cleanup" }),
      }).catch((error) => {
        console.error("Failed to cleanup agent:", error);
      });
    };
  }, []);

  const askQuestion = async (message: string) => {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "question", message }),
    });

    return response;
  };

  return { askQuestion };
};
