import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegistrationRequest {
  phone: string;
  name: string;
  attendee_count: number;
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
    const { phone, name, attendee_count } = requestData;

    console.log('Registration request:', { phone, name, attendee_count });

    // Validate input
    if (!phone || !name || !attendee_count) {
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

    // Check for duplicate phone number
    const { data: existingAttendee, error: checkError } = await supabase
      .from('attendees')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing attendee:', checkError);
      return new Response(
        JSON.stringify({ error: '중복 확인 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingAttendee) {
      return new Response(
        JSON.stringify({ error: '이미 등록된 전화번호입니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active seat rows
    const { data: seatRows, error: rowsError } = await supabase
      .from('seat_layout')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (rowsError || !seatRows) {
      console.error('Error fetching seat rows:', rowsError);
      return new Response(
        JSON.stringify({ error: '좌석 정보를 가져오는 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all existing attendees with seat assignments
    const { data: existingAttendees, error: attendeesError } = await supabase
      .from('attendees')
      .select('seat_number')
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

    // Insert new attendee with assigned seats
    const seatNumberString = selectedSeats.join(', ');
    const { data: newAttendee, error: insertError } = await supabase
      .from('attendees')
      .insert({
        phone,
        name,
        attendee_count,
        seat_number: seatNumberString,
      })
      .select()
      .single();

    if (insertError || !newAttendee) {
      console.error('Error inserting attendee:', insertError);
      return new Response(
        JSON.stringify({ error: '좌석 등록 중 오류가 발생했습니다' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully registered:', newAttendee);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: newAttendee 
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
