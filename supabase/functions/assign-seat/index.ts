import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationRequest {
  phone: string;
  name: string;
  attendee_count: number;
  session_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData: RegistrationRequest = await req.json();
    const { phone, name, attendee_count, session_id } = requestData;

    console.log('Registration request:', { phone, name, attendee_count, session_id });

    // Validate input
    if (!phone || !name || !attendee_count || !session_id) {
      return new Response(
        JSON.stringify({ error: '모든 필드를 입력해주세요' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (attendee_count < 1) {
      return new Response(
        JSON.stringify({ error: '참석 인원은 최소 1명 이상이어야 합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if attendee is in pre-registered list (phone + name + session match)
    const { data: existingAttendee, error: checkError } = await supabase
      .from('attendees')
      .select('*')
      .eq('phone', phone)
      .eq('name', name)
      .eq('session_id', session_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing attendee:', checkError);
      return new Response(
        JSON.stringify({ error: '명단 확인 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Not in pre-registered list
    if (!existingAttendee) {
      return new Response(
        JSON.stringify({ error: '사전 신청자 명단에 없습니다. 관리자에게 문의해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Already has seat assigned - return success with existing data
    if (existingAttendee.seat_number) {
      console.log('Seat already assigned, returning existing data');
      return new Response(
        JSON.stringify({ 
          success: true,
          already_assigned: true,
          data: existingAttendee
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Valid pre-registered attendee without seat assignment
    console.log('Valid pre-registered attendee, assigning seat:', existingAttendee.id);

    // Get active seat rows for this session
    const { data: seatRows, error: rowsError } = await supabase
      .from('seat_layout')
      .select('*')
      .eq('session_id', session_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (rowsError || !seatRows) {
      console.error('Error fetching seat rows:', rowsError);
      return new Response(
        JSON.stringify({ error: '좌석 정보를 가져오는 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all existing attendees with seat assignments for this session
    const { data: existingAttendees, error: attendeesError } = await supabase
      .from('attendees')
      .select('seat_number')
      .eq('session_id', session_id)
      .not('seat_number', 'is', null);

    if (attendeesError) {
      console.error('Error fetching existing attendees:', attendeesError);
      return new Response(
        JSON.stringify({ error: '기존 좌석 정보를 가져오는 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse all assigned seats
    const assignedSeats = new Set<string>();
    if (existingAttendees) {
      existingAttendees.forEach((attendee) => {
        if (attendee.seat_number) {
          const seats = attendee.seat_number.split(',').map((s: string) => s.trim());
          seats.forEach((seat: string) => assignedSeats.add(seat));
        }
      });
    }

    console.log('Assigned seats:', Array.from(assignedSeats));

    // Generate all possible seats
    const allSeats: string[] = [];
    for (const row of seatRows) {
      for (let i = 1; i <= row.seat_count; i++) {
        const seatNum = i.toString().padStart(2, '0');
        allSeats.push(`${row.row_label}-${seatNum}`);
      }
    }

    // Find available seats in order
    const availableSeats = allSeats.filter(seat => !assignedSeats.has(seat));

    console.log('Available seats:', availableSeats);

    if (availableSeats.length < attendee_count) {
      return new Response(
        JSON.stringify({ error: '사용 가능한 좌석이 부족합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign seats based on attendee count
    let selectedSeats: string[] = [];

    if (attendee_count === 1) {
      // Single attendee: take the first available seat
      selectedSeats = [availableSeats[0]];
    } else {
      // Multiple attendees: try to assign consecutive seats in the same row
      let assigned = false;

      for (const row of seatRows) {
        if (assigned) break;

        // Get available seats in this row
        const rowSeats = availableSeats.filter(seat => seat.startsWith(`${row.row_label}-`));
        
        if (rowSeats.length >= attendee_count) {
          // Check if we have consecutive seats
          const rowNumbers = rowSeats.map(seat => {
            const parts = seat.split('-');
            return parseInt(parts[1], 10);
          }).sort((a, b) => a - b);

          // Find consecutive sequence
          for (let i = 0; i <= rowNumbers.length - attendee_count; i++) {
            let isConsecutive = true;
            for (let j = 0; j < attendee_count - 1; j++) {
              if (rowNumbers[i + j + 1] - rowNumbers[i + j] !== 1) {
                isConsecutive = false;
                break;
              }
            }

            if (isConsecutive) {
              // Found consecutive seats
              for (let j = 0; j < attendee_count; j++) {
                const seatNum = rowNumbers[i + j].toString().padStart(2, '0');
                selectedSeats.push(`${row.row_label}-${seatNum}`);
              }
              assigned = true;
              break;
            }
          }
        }
      }

      // If no consecutive seats found, assign from the next row's beginning
      if (!assigned) {
        selectedSeats = availableSeats.slice(0, attendee_count);
      }
    }

    console.log('Selected seats:', selectedSeats);

    // Update existing attendee with seat assignment
    const seatNumberString = selectedSeats.join(', ');
    const { data: updatedAttendee, error: updateError } = await supabase
      .from('attendees')
      .update({
        attendee_count,
        seat_number: seatNumberString,
      })
      .eq('id', existingAttendee.id)
      .select()
      .single();

    if (updateError || !updatedAttendee) {
      console.error('Error updating attendee:', updateError);
      return new Response(
        JSON.stringify({ error: '좌석 배정 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully assigned seat:', updatedAttendee);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: updatedAttendee 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
