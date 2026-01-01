
import { WegMotorData, DimensioningResult, ProjectSummary } from './types';

/**
 * TABELA DE AMPACIDADE NBR 5410 (MÉTODO B1) - COBRE PVC 70°C
 */
const NBR_5410_B1 = [
  { size: 1.5, amp: 17.5 },
  { size: 2.5, amp: 24 },
  { size: 4, amp: 32 },
  { size: 6, amp: 41 },
  { size: 10, amp: 57 },
  { size: 16, amp: 76 },
  { size: 25, amp: 101 },
  { size: 35, amp: 125 },
  { size: 50, amp: 151 },
  { size: 70, amp: 192 },
  { size: 95, amp: 232 },
  { size: 120, amp: 269 },
  { size: 150, amp: 309 },
  { size: 185, amp: 353 },
  { size: 240, amp: 415 },
  { size: 300, amp: 473 }
];

export const calculateDimensioning = (motor: WegMotorData, distance: number = 5): DimensioningResult => {
  const In = motor.currentIn;
  
  /**
   * COEFICIENTE OURO 1.50x (FIXO)
   * Dimensionamento de precisão com folga térmica Safe-Ideal.
   */
  const designCurrent = In * 1.50;
  
  // 1. Seleção por ampacidade térmica
  let selected = NBR_5410_B1.find(c => c.amp >= designCurrent) || NBR_5410_B1[NBR_5410_B1.length - 1];

  /**
   * 2. VERIFICAÇÃO DE QUEDA DE TENSÃO (NBR 5410)
   * Limite: 4% (15.2V para rede 380V)
   */
  const maxDeltaV = 15.2; 
  const cosPhi = motor.powerFactor || 0.85;
  const conductivity = 56; 

  const checkVoltageDrop = (bitola: number) => {
    return (1.732 * In * distance * cosPhi) / (conductivity * bitola);
  };

  let finalBitola = selected;
  // Itera para garantir que a distância não ultrapasse a queda de tensão permitida
  for (const item of NBR_5410_B1) {
    if (item.size < selected.size) continue;
    const drop = checkVoltageDrop(item.size);
    if (drop <= maxDeltaV) {
      finalBitola = item;
      break;
    }
    finalBitola = item;
  }

  const currentDrop = checkVoltageDrop(finalBitola.size);
  const dropPercentage = ((currentDrop / 380) * 100).toFixed(2);

  const breaker = motor.cv <= 40 ? `MPW40-${In.toFixed(1)}A` : `DWA-${Math.ceil(In * 1.25)}A`;
  
  let contactor = "CWM9";
  if (In > 9) contactor = "CWM12";
  if (In > 12) contactor = "CWM18";
  if (In > 18) contactor = "CWM25";
  if (In > 25) contactor = "CWM32";
  if (In > 32) contactor = "CWM40";
  if (In > 40) contactor = "CWM50";
  if (In > 50) contactor = "CWM65";
  if (In > 65) contactor = "CWM80";
  if (In > 80) contactor = "CWM105";
  if (In > 105) contactor = "CWM150";
  if (In > 150) contactor = "CWM250";
  if (In > 250) contactor = "CWM400";

  return {
    motor,
    circuitBreaker: breaker,
    cableSize: `${finalBitola.size}mm²`,
    contactor: contactor,
    thermalRelay: `RW27/RW67`,
    starterType: motor.cv >= 10 ? 'SOFT-STARTER' : 'DIRETA',
    inverter: motor.cv <= 20 ? 'CFW500' : 'CFW11',
    voltageDrop: `${dropPercentage}%`
  };
};

export const calculateGeneralSummary = (motorsWithDist: {motor: WegMotorData, distance: number}[]): ProjectSummary => {
  const totalIn = motorsWithDist.reduce((acc, item) => acc + item.motor.currentIn, 0);
  const totalCv = motorsWithDist.reduce((acc, item) => acc + item.motor.cv, 0);
  
  const mainBreakerValue = [40, 63, 100, 125, 160, 200, 250, 400, 630, 800, 1000].find(r => r >= totalIn * 1.25) || 40;

  const details = motorsWithDist.map(item => calculateDimensioning(item.motor, item.distance));

  return {
    motorCount: motorsWithDist.length,
    totalCv: parseFloat(totalCv.toFixed(1)),
    totalKw: parseFloat((totalCv * 0.735).toFixed(1)),
    totalIn: parseFloat(totalIn.toFixed(1)),
    recommendedMainBreaker: `Disjuntor Geral ${mainBreakerValue}A`,
    details
  };
};
