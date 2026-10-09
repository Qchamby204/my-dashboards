/* One local-time boundary for public and private Home. */
export const EVENING_HOUR=18;
export const dailyPhase=(now=new Date())=>now.getHours()>=EVENING_HOUR?'evening':'morning';
