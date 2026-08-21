function hoursForShift(shift) {
  const [startHour, startMinute] = String(shift.start || '00:00').split(':').map(Number);
  const [endHour, endMinute] = String(shift.end || '00:00').split(':').map(Number);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, minutes - (Number(shift.breakMinutes) || 0)) / 60;
}

export function calculateLaborCostBreakdown(data, startDate, endDate) {
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const shifts = Array.isArray(data?.shifts) ? data.shifts : [];
  const employeeById = new Map(employees.map(employee => [employee.id, employee]));
  const hourly = shifts
    .filter(shift => shift.date >= startDate && shift.date <= endDate && shift.status !== 'called-off')
    .reduce((sum, shift) => {
      const employee = employeeById.get(shift.employeeId);
      if (!employee || employee.payType === 'salary') return sum;
      return sum + hoursForShift(shift) * (Number(employee.hourlyRate) || 0);
    }, 0);
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const dayCount = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
    ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
    : 0;
  const salaried = employees
    .filter(employee => employee.active !== false && employee.payType === 'salary')
    .reduce((sum, employee) => sum + ((Number(employee.annualSalary) || 0) / 365) * dayCount, 0);
  return { hourly, salaried, total: hourly + salaried };
}
