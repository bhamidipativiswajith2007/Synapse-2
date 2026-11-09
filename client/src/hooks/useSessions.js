import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { sessionApi } from "../api/sessions";

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["createSession"],
    mutationFn: sessionApi.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
      toast.success("Session created successfully!");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to create room"),
  });

  return result;
};

export const useActiveSessions = () => {
  const result = useQuery({
    queryKey: ["activeSessions"],
    queryFn: sessionApi.getActiveSessions,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000, // automatic background refresh fallback
  });

  return result;
};

export const useMyRecentSessions = () => {
  const result = useQuery({
    queryKey: ["myRecentSessions"],
    queryFn: sessionApi.getMyRecentSessions,
    refetchInterval: 10000,
  });

  return result;
};

export const useSessionById = (id) => {
  const result = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionApi.getSessionById(id),
    enabled: !!id,
    refetchInterval: 5000, // refetch every 5 seconds to detect session status changes
  });

  return result;
};

export const useJoinSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["joinSession"],
    mutationFn: sessionApi.joinSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
      toast.success("Joined session successfully!");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
  });

  return result;
};

export const useLeaveSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["leaveSession"],
    mutationFn: sessionApi.leaveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
      queryClient.invalidateQueries({ queryKey: ["myRecentSessions"] });
    },
    onError: (error) => console.error("Error leaving session:", error),
  });

  return result;
};

export const useEndSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["endSession"],
    mutationFn: sessionApi.endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
      queryClient.invalidateQueries({ queryKey: ["myRecentSessions"] });
      toast.success("Session ended successfully!");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to end session"),
  });

  return result;
};
