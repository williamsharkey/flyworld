/** All callers retarget at currentTime; retain today's value on older engines. */
export function holdNow(param, time) {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(time);
  } else {
    const value = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(value, time);
  }
}
