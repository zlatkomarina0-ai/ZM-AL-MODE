/**
 * ZLATKO AI MODE — First Brain (provider-neutral orchestration core)
 *
 * This module coordinates model adapters; it does not pretend that external
 * models are connected until real adapters and server-side credentials exist.
 */

export type BrainTask = {
  id: string;
  title: string;
  objective: string;
  input: string;
  context?: string;
};

export type AgentReply = {
  agentId: string;
  provider: string;
  content: string;
  completedAt: string;
};

export type AgentFailure = {
  agentId: string;
  provider: string;
  error: string;
};

export type CouncilReport = {
  taskId: string;
  status: "completed" | "partial" | "failed";
  replies: AgentReply[];
  failures: AgentFailure[];
  synthesis?: string;
  notes: string[];
};

export interface ModelAgent {
  /** Stable internal identifier, e.g. "gpt", "claude", or "deepseek". */
  id: string;
  /** Human-readable provider/model label. */
  provider: string;
  /** Optional role description used by a provider adapter. */
  role: string;
  /** Implement this with a real server-side API adapter. */
  run(task: BrainTask): Promise<string>;
}

export type SynthesisFunction = (
  task: BrainTask,
  replies: AgentReply[],
) => Promise<string>;

/**
 * The First Brain asks all configured agents independently, records failures,
 * and optionally asks a synthesis adapter to compare the successful replies.
 * One unavailable model must not stop the whole council.
 */
export async function runFirstBrain(
  task: BrainTask,
  agents: ModelAgent[],
  synthesize?: SynthesisFunction,
): Promise<CouncilReport> {
  if (!task.id.trim() || !task.objective.trim() || !task.input.trim()) {
    throw new Error("Task id, objective, and input are required.");
  }

  if (agents.length === 0) {
    return {
      taskId: task.id,
      status: "failed",
      replies: [],
      failures: [],
      notes: ["No model agents are configured. Connect at least one real adapter."],
    };
  }

  const settled = await Promise.allSettled(
    agents.map(async (agent): Promise<AgentReply> => {
      const content = await agent.run(task);
      if (!content || !content.trim()) {
        throw new Error("Agent returned an empty response.");
      }
      return {
        agentId: agent.id,
        provider: agent.provider,
        content: content.trim(),
        completedAt: new Date().toISOString(),
      };
    }),
  );

  const replies: AgentReply[] = [];
  const failures: AgentFailure[] = [];

  settled.forEach((result, index) => {
    const agent = agents[index];
    if (result.status === "fulfilled") {
      replies.push(result.value);
    } else {
      const reason = result.reason;
      failures.push({
        agentId: agent.id,
        provider: agent.provider,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });

  let synthesis: string | undefined;
  const notes: string[] = [];

  if (replies.length > 1 && synthesize) {
    try {
      synthesis = await synthesize(task, replies);
    } catch (error) {
      notes.push(
        `Synthesis failed; individual replies are preserved. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else if (replies.length > 1) {
    notes.push("Replies are independent; no synthesis adapter is configured.");
  }

  if (replies.length === 0) {
    notes.push("All configured agents failed. Check adapter configuration and server logs.");
  }

  return {
    taskId: task.id,
    status: replies.length === 0 ? "failed" : failures.length > 0 ? "partial" : "completed",
    replies,
    failures,
    ...(synthesis ? { synthesis } : {}),
    notes,
  };
}
