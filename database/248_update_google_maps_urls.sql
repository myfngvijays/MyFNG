-- Update google_maps_url for existing workshop public pages based on GMB business name match
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('MY FNG - Multi-Brand Car Servicing and Repairs Across India', 'https://maps.google.com/maps?cid=9338020820420071773'),
      ('My FNG - Multi Brand Car Garage & Repairs at Vartak Nagar, Thane West', 'https://maps.google.com/maps?cid=5904923044467479011'),
      ('My FNG - Multi Brand Car Garage & Repairs at Manpada, Thane West', 'https://maps.google.com/maps?cid=1052054665275590930'),
      ('My FNG - Multi Brand Car Garage & Repairs at Majiwada, Thane West', 'https://maps.google.com/maps?cid=5733014544512311485'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kasarvadavali, Thane West', 'https://maps.google.com/maps?cid=2501459740412008979'),
      ('My FNG - Multi Brand Car Garage & Repairs at GB Road, Thane West', 'https://maps.google.com/maps?cid=13420830194333739017'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kalyan-Shilphata Marg, Dombivli East', 'https://maps.google.com/maps?cid=7899135893631738536'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kolegaon, Dombivli East', 'https://maps.google.com/maps?cid=2845665350285293228'),
      ('My FNG - Multi Brand Car Garage & Repairs at Malang Gad Road, Kalyan East', 'https://maps.google.com/maps?cid=2287869461652122720'),
      ('My FNG - Multi Brand Car Garage & Repairs at Chikanghar, Kalyan West', 'https://maps.google.com/maps?cid=10600780385640890391'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ambernath-Badlapur Rd, Ambernath', 'https://maps.google.com/maps?cid=8583333482079871862'),
      ('My FNG - Multi Brand Car Garage & Repairs at Neral-Badlapur Rd, Badlapur', 'https://maps.google.com/maps?cid=5934983091970685837'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kalyan-Sape Rd, Bhiwandi', 'https://maps.google.com/maps?cid=13277842312733952708'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ghotsai Rd, Titwala', 'https://maps.google.com/maps?cid=10143953702899931823'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ramdev Park Rd, Mira Road East', 'https://maps.google.com/maps?cid=176332123689468773'),
      ('My FNG - Multi Brand Car Garage & Repairs at Miragaon Rd, Mira Road East', 'https://maps.google.com/maps?cid=12870315788032845092'),
      ('My FNG - Multi Brand Car Garage & Repairs at S Central Road, Shiravane, Nerul', 'https://maps.google.com/maps?cid=7322580518841501130'),
      ('My FNG - Multi Brand Car Garage & Repairs at Shiravane, Nerul', 'https://maps.google.com/maps?cid=1786849421157110030'),
      ('My FNG - Multi Brand Car Garage & Repairs at Pawne, Koparkhairane', 'https://maps.google.com/maps?cid=10798882487535161274'),
      ('My FNG - Multi Brand Car Garage & Repairs at Bangli Road, Vasai West', 'https://maps.google.com/maps?cid=15098871612145056906'),
      ('My FNG - Multi Brand Car Garage & Repairs at Waliv Road, Vasai East', 'https://maps.google.com/maps?cid=2060443413734103226'),
      ('My FNG - Multi Brand Car Garage & Repairs at Bolinj-Sopara Rd, Virar West', 'https://maps.google.com/maps?cid=11380870152620102093'),
      ('My FNG - Multi Brand Car Garage & Repairs at Boisar-Tarapur Rd, Boisar', 'https://maps.google.com/maps?cid=5022731953108571877'),
      ('My FNG - Multi Brand Car Garage & Repairs in Palghar', 'https://maps.google.com/maps?cid=2150262516104754377'),
      ('My FNG - Multi Brand Car Garage & Repairs at Saki Vihar Rd, Andheri East', 'https://maps.google.com/maps?cid=17179374910215896790'),
      ('My FNG - Multi Brand Car Garage & Repairs at Jankalyan Nagar, Malad West', 'https://maps.google.com/maps?cid=5871850074948606159'),
      ('My FNG - Multi Brand Car Garage & Repairs at Moti Nagar, Mulund West', 'https://maps.google.com/maps?cid=13391761220544515356'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ambedkar Nagar, Dadar West', 'https://maps.google.com/maps?cid=3976202849164761856'),
      ('My FNG - Multi Brand Car Garage & Repairs at SV Rd, Vile Parle West', 'https://maps.google.com/maps?cid=710477492697919403'),
      ('My FNG - Multi Brand Car Garage & Repairs at Dr. EM Rd, Mahalaxmi', 'https://maps.google.com/maps?cid=4089000231838676816'),
      ('My FNG - Multi Brand Car Garage & Repairs at Milind Nagar, Ghatkopar West', 'https://maps.google.com/maps?cid=9992277547142083649'),
      ('My FNG - Multi Brand Car Garage & Repairs at HOC Colony, Panvel', 'https://maps.google.com/maps?cid=12739516267242259149'),
      ('My FNG - Multi Brand Car Garage & Repairs at Shivaji Nagar, Panvel', 'https://maps.google.com/maps?cid=556627525135831026'),
      ('My FNG - Multi Brand Car Garage & Repairs at Steel Market Rd, Kalamboli', 'https://maps.google.com/maps?cid=13844971644996931744'),
      ('My FNG - Multi Brand Car Garage & Repairs at Yashwant Nagar, Khopoli', 'https://maps.google.com/maps?cid=195388331792230564'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kandarpada, Dahisar West', 'https://maps.google.com/maps?cid=10422963848436870074'),
      ('My FNG - Multi Brand Car Garage & Repairs at Charkop, Kandivali West', 'https://maps.google.com/maps?cid=10849364526673053823'),
      ('My FNG - Multi Brand Car Garage & Repairs at New Link Rd, Borivali West', 'https://maps.google.com/maps?cid=5553365994448258959'),
      ('My FNG - Multi Brand Car Garage & Repairs at Mahul, Chembur', 'https://maps.google.com/maps?cid=15718005619996371206'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ashoka Nagar, Kharadi, Pune', 'https://maps.google.com/maps?cid=8718316333549619403'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ganesh Temple, Saswad, Pune', 'https://maps.google.com/maps?cid=16930542103673114869'),
      ('My FNG - Multi Brand Car Garage & Repairs at Kate Petrol Pump, Pimple Saudagar, Pimpri-Chinchwad, Pune', 'https://maps.google.com/maps?cid=4762588774595209298'),
      ('My FNG - Multi Brand Car Garage & Repairs at Pashan Link Rd, Baner, Pune', 'https://maps.google.com/maps?cid=6558989866479742967'),
      ('My FNG - Multi Brand Car Garage & Repairs at Ahilyanagar Highway, Wagholi, Pune', 'https://maps.google.com/maps?cid=12994117400297441003'),
      ('My FNG - Multi Brand Car Garage & Repairs at Santoshi Mata Rd, Katraj, Pune', 'https://maps.google.com/maps?cid=4642216826512932997'),
      ('My FNG - Multi Brand Car Garage & Repairs at Sakore Nagar, Vimanagar, Pune', 'https://maps.google.com/maps?cid=5496891404460920430'),
      ('My FNG - Multi Brand Car Garage & Repairs at Hinjawadi Aundh Rd, Wakad, Pune', 'https://maps.google.com/maps?cid=18142451708426430146'),
      ('My FNG - Multi Brand Car Garage & Repairs at Dattawadi, Tathawade, Pune', 'https://maps.google.com/maps?cid=7307106200573416306'),
      ('My FNG - Multi Brand Car Garage & Repairs at Park Town Rd, Hadapsar, Pune', 'https://maps.google.com/maps?cid=2614240928643400602'),
      ('My FNG - Multi Brand Car Garage & Repairs at Anand Nagar, Suncity, Pune', 'https://maps.google.com/maps?cid=9582181483204343923'),
      ('My FNG - Multi Brand Car Garage & Repairs at Lohgaon-Wagholi Rd, Baner, Pune', 'https://maps.google.com/maps?cid=6164793631015437369'),
      ('My FNG - Multi Brand Car Garage & Repairs at Pathardi Phata, Nashik', 'https://maps.google.com/maps?cid=18435111874953271411')
    ) AS t(business_name, map_url)
  LOOP
    UPDATE public.workshop_public_pages
    SET google_maps_url = rec.map_url
    WHERE gmb_data->>'business_name' = rec.business_name
      AND (google_maps_url IS NULL OR google_maps_url = '');
  END LOOP;
END $$;
