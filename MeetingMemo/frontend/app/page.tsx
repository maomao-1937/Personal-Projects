import { AccessGate } from "@/components/access-gate";
import { MeetingMemoApp } from "@/components/meetingmemo-app";

export default function Home() {
  return (
    <AccessGate>
      <MeetingMemoApp />
    </AccessGate>
  );
}
