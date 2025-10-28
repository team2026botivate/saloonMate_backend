import dayjs from 'dayjs';
import { supabase } from '../helper/supabase.js';

export const doStaffPaymentStatusReset = async () => {
  const { data: staffPaymentstatus, error } = await supabase
    .from('staff_info')
    .select('id ,last_payment')
    .eq('payment_status', 'paid');

  if (error) return console.log(error);

  const toDetective = staffPaymentstatus.filter((item) => {
    if (!item.last_payment) return false;
    const nextDue = dayjs(item.last_payment).add(1, 'month');
    return dayjs().isAfter(nextDue);
  });

  await Promise.all(
    toDetective.map(async (item) => {
      try {
        const { error } = await supabase
          .from('staff_info')
          .update({
            payment_status: 'pending',
          })
          .eq('id', item.id);

        if (error) {
          console.error(error);
          return { id: item.id, success: false, error: error.message };
        }
      } catch (error: any) {
        console.error(error);
      }
    })
  );
};
