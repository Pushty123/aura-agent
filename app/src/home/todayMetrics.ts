import type { DayRecord } from '../types';
import type { MetricCardProps } from '../components/design-system';
import { balanceScore } from '../insights/balance';
import type { Permissions } from '../lib/permissions';
import type { Workout } from '../exercise/workouts';

const EMPTY_VALUE = 'No data yet';
const MOOD_LABELS = ['', 'Low', 'Fair', 'Okay', 'Good', 'Great'];

function isReadable(day: DayRecord | undefined, field: keyof DayRecord, permission: keyof Permissions, permissions: Permissions): boolean {
  if (!day || day.source !== 'device') return true;
  return permissions[permission] || Boolean(day.manualFields?.includes(field));
}

function visibleDeviceData(day: DayRecord | undefined, permissions: Permissions): DayRecord | undefined {
  if (!day || day.source !== 'device') return day;
  const visible = { ...day };
  if (!isReadable(day, 'screenMinutes', 'usage', permissions)) {
    delete visible.screenMinutes;
    delete visible.lateScreenMin;
  }
  if (!isReadable(day, 'sleepHours', 'sleep', permissions)) delete visible.sleepHours;
  if (!isReadable(day, 'steps', 'steps', permissions)) delete visible.steps;
  if (!isReadable(day, 'exerciseMinutes', 'steps', permissions)) delete visible.exerciseMinutes;
  return visible;
}

function card(
  kind: MetricCardProps['kind'],
  label: string,
  value: string | number | undefined,
  unit: string | undefined,
  demo: boolean,
  range?: MetricCardProps['range'],
): MetricCardProps {
  return {
    kind,
    label,
    value: value ?? EMPTY_VALUE,
    unit: value === undefined ? undefined : unit,
    timestamp: value === undefined ? 'No reading recorded' : 'Today',
    demo: value !== undefined && demo,
    range: value === undefined ? undefined : range,
  };
}

export function todayMetrics(
  day: DayRecord | undefined,
  history: DayRecord[],
  permissions: Permissions,
  workouts: Workout[],
): MetricCardProps[] {
  const demo = day?.source === 'demo';
  const heartRate = permissions.heartRate ? day?.avgHeartRate : undefined;
  const systolic = permissions.heartRate ? day?.bloodPressureSystolic : undefined;
  const diastolic = permissions.heartRate ? day?.bloodPressureDiastolic : undefined;
  const steps = isReadable(day, 'steps', 'steps', permissions) ? day?.steps : undefined;
  const sleep = isReadable(day, 'sleepHours', 'sleep', permissions) ? day?.sleepHours : undefined;
  const mood = day?.mood === undefined ? undefined : MOOD_LABELS[day.mood];
  const water = day?.waterGlasses;
  const exerciseMinutes = (
    isReadable(day, 'exerciseMinutes', 'steps', permissions) ? day?.exerciseMinutes : undefined
  ) ?? (() => {
    const seconds = workouts.filter((workout) => workout.date === day?.date).reduce((total, workout) => total + workout.seconds, 0);
    return seconds > 0 ? Math.round(seconds / 60) : undefined;
  })();
  const scoreDay = visibleDeviceData(day, permissions);
  const scoreHistory = history.map((record) => visibleDeviceData(record, permissions)!);
  const hasBalanceInputs = Boolean(
    scoreDay && (
      scoreDay.sleepHours !== undefined ||
      scoreDay.steps !== undefined ||
      scoreDay.screenMinutes !== undefined ||
      scoreDay.mood !== undefined ||
      scoreDay.waterGlasses !== undefined ||
      scoreDay.workout !== undefined
    ),
  );
  const score = scoreDay && hasBalanceInputs ? balanceScore(scoreDay, scoreHistory).score : undefined;

  return [
    ...(permissions.heartRate ? [
      card('heart', 'Heart rate', heartRate, 'bpm', demo, heartRate === undefined ? undefined : {
        min: 40, max: 180, value: heartRate, label: 'Heart rate range',
      }),
      card(
        'blood-pressure',
        'Blood pressure',
        systolic !== undefined && diastolic !== undefined ? `${systolic}/${diastolic}` : undefined,
        'mmHg',
        demo,
        systolic === undefined ? undefined : {
          min: 80, max: 180, value: systolic, label: 'Systolic blood pressure range',
        },
      ),
    ] : []),
    card('exercise', 'Exercise', exerciseMinutes, 'min', demo && day?.exerciseMinutes !== undefined),
    card('sleep', 'Sleep', sleep, 'hrs', demo, sleep === undefined ? undefined : {
      min: 0, max: 12, value: sleep, label: 'Sleep duration range',
    }),
    card('steps', 'Steps', steps?.toLocaleString(), 'steps', demo, steps === undefined ? undefined : {
      min: 0, max: 12000, value: steps, label: 'Steps range',
    }),
    card('water', 'Water', water, 'glasses', demo),
    card('mood', 'Mood', mood, undefined, demo),
    card('balance', 'Balance Score', score, '/100', demo, score === undefined ? undefined : {
      min: 0, max: 100, value: score, label: 'Balance Score range',
    }),
  ];
}
