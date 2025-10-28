import cron from 'node-cron';

interface cronJobProps {
  pattern: string;
  task: () => void;
}

export const cornJob = ({ pattern, task }: cronJobProps) => {
  try {
    cron.schedule(pattern, task);
  } catch (error) {
    console.error(error);
  }
};
