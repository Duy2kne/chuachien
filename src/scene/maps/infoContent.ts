// Nội dung các bảng thông tin trong cảnh (đứng gần bia / biển tầng thì hiện lên).
// Muốn sửa chữ: sửa trực tiếp ở đây, không cần đụng tới phần dựng hình.

export interface InfoContent {
  title: string;
  subtitle?: string;
  sin?: string;       // Tội (dành cho kẻ...)
  punish?: string;    // Quả báo / hình phạt
  advice?: string;    // Hướng thiện
  body?: string;      // Đoạn giới thiệu chung
  note?: string;      // Ghi chú thêm (hiện ở cuối, chữ nhỏ)
}

export interface HellLevel {
  n: number;
  name: string;       // Tên Hán Việt
  short: string;      // Tên ngắn khắc trên biển
  meaning: string;    // Nghĩa
  sin: string;
  punish: string;
  advice: string;
}

export const HELL_LEVELS: HellLevel[] = [
  { n: 1, name: 'Bạt Thiệt Địa Ngục', short: 'BẠT THIỆT', meaning: 'Ngục kéo lưỡi',
    sin: 'Kẻ lúc sống hay nói dối, chia rẽ, chửi rủa, lừa gạt.',
    punish: 'Bị quỷ dùng kìm sắt kẹp chặt lưỡi rồi kéo dài ra.',
    advice: 'Giữ lời chân thật, nói lời ái ngữ; không nói lời chia rẽ, thêu dệt.' },
  { n: 2, name: 'Cắt Đao Địa Ngục', short: 'CẮT ĐAO', meaning: 'Ngục kéo cắt',
    sin: 'Kẻ xúi giục phụ nữ góa chồng tái giá hoặc làm mai mối lừa đảo.',
    punish: 'Bị quỷ cắt đứt mười đầu ngón tay.',
    advice: 'Tôn trọng lựa chọn và hạnh phúc của người khác; không lấy chuyện nhân duyên ra lừa lọc.' },
  { n: 3, name: 'Thiết Thụ Địa Ngục', short: 'THIẾT THỤ', meaning: 'Ngục cây chông sắt',
    sin: 'Kẻ chia rẽ tình mẫu tử, tình anh em ruột thịt.',
    punish: 'Bị cắm vào những cành cây chông sắt nhọn hoắt.',
    advice: 'Vun đắp tình thân, hoà giải bất hoà trong gia đình.' },
  { n: 4, name: 'Nghiệt Kính Địa Ngục', short: 'NGHIỆT KÍNH', meaning: 'Ngục gương soi tội',
    sin: 'Kẻ phạm tội nhưng trốn tránh, che giấu lỗi lầm.',
    punish: 'Linh hồn phải soi vào gương thần để hiện rõ mọi tội ác, sau đó chuyển sang các tầng ngục khác để chịu phạt.',
    advice: 'Biết nhận lỗi và sửa lỗi; sám hối chân thành thì tâm được nhẹ nhàng.' },
  { n: 5, name: 'Chưng Lung Địa Ngục', short: 'CHƯNG LUNG', meaning: 'Ngục lồng hấp',
    sin: 'Kẻ hay tung tin đồn nhảm, hãm hại người lương thiện.',
    punish: 'Bị nhốt vào lồng kín rồi đốt lửa hấp sống, sau đó gió lạnh thổi vào cho sống lại để phạt tiếp.',
    advice: 'Không nghe, không truyền lời đồn; nói về người khác như khi họ đang có mặt.' },
  { n: 6, name: 'Đồng Trụ Địa Ngục', short: 'ĐỒNG TRỤ', meaning: 'Ngục cột đồng đốt nóng',
    sin: 'Kẻ phóng hỏa giết người, hủy hoại tài sản hoặc bằng chứng.',
    punish: 'Bị lột sạch quần áo rồi ôm chặt vào cột đồng đang đốt đỏ rực.',
    advice: 'Giữ gìn của cải chung và của người; sống ngay thẳng, không che lấp sự thật.' },
  { n: 7, name: 'Đao Sơn Địa Ngục', short: 'ĐAO SƠN', meaning: 'Ngục núi dao',
    sin: 'Kẻ sát sinh vô tội vạ, giết hại động vật hoặc con người.',
    punish: 'Phải trần truồng trèo qua ngọn núi đầy dao sắc nhọn.',
    advice: 'Thương yêu muôn loài, phóng sinh, ăn chay khi có thể.' },
  { n: 8, name: 'Băng Sơn Địa Ngục', short: 'BĂNG SƠN', meaning: 'Ngục núi băng',
    sin: 'Kẻ thông dâm, bất hiếu, cờ bạc, phụ bạc tình nghĩa.',
    punish: 'Bị lột đồ và đày lên ngọn núi băng lạnh giá cho đến khi cơ thể đông cứng, nứt nẻ.',
    advice: 'Chung thuỷ, hiếu thảo với cha mẹ; tránh xa cờ bạc.' },
  { n: 9, name: 'Dầu Oa Địa Ngục', short: 'DẦU OA', meaning: 'Ngục vạc dầu',
    sin: 'Kẻ trộm cắp, bắt nạt người yếu thế, lừa thầy phản bạn.',
    punish: 'Bị quỷ ném vào vạc dầu sôi sùng sục.',
    advice: 'Không lấy của không cho; che chở người yếu, giữ trọn nghĩa thầy bạn.' },
  { n: 10, name: 'Ngưu Khanh Địa Ngục', short: 'NGƯU KHANH', meaning: 'Ngục trâu húc',
    sin: 'Kẻ ngược đãi động vật, giết trâu bò làm việc nghĩa vô cớ.',
    punish: 'Bị đưa vào hang, nơi có hàng vạn con trâu rừng hung hãn dùng sừng húc và giẫm đạp nát cơ thể.',
    advice: 'Biết ơn và đối xử tử tế với loài vật đã giúp sức cho con người.' },
  { n: 11, name: 'Thạch Áp Địa Ngục', short: 'THẠCH ÁP', meaning: 'Ngục đá đè',
    sin: 'Kẻ bỏ rơi, ngược đãi hoặc giết hại con trẻ.',
    punish: 'Bị đưa vào một chiếc hố lớn, phía trên thả những tảng đá khổng lồ xuống đè bẹp.',
    advice: 'Yêu thương, chăm sóc và bảo vệ trẻ nhỏ.' },
  { n: 12, name: 'Thung Cữu Địa Ngục', short: 'THUNG CỮU', meaning: 'Ngục giã cối',
    sin: 'Kẻ lãng phí lương thực, đồ ăn thức uống, hoặc mắng chửi người khác lúc ăn.',
    punish: 'Bị bỏ vào cối giã gạo khổng lồ và bị giã nát thịt xương.',
    advice: 'Quý trọng hạt cơm, ăn uống đủ dùng; giữ hoà khí trong bữa ăn.' },
  { n: 13, name: 'Huyết Trì Địa Ngục', short: 'HUYẾT TRÌ', meaning: 'Ngục bể máu',
    sin: 'Kẻ không tôn trọng cha mẹ, bất kính với thần phật, đi theo đường tà đạo.',
    punish: 'Bị dìm trong bể máu tanh hôi, chịu sự cắn xé của ác quỷ.',
    advice: 'Kính trọng cha mẹ, thầy tổ và Tam Bảo; tin sâu nhân quả, giữ chánh kiến.' },
  { n: 14, name: 'Uổng Tử Địa Ngục', short: 'UỔNG TỬ', meaning: 'Ngục chết oan / tự tử',
    sin: 'Kẻ không trân trọng mạng sống, tự sát (cắt tay, treo cổ...) khi chưa tận số.',
    punish: 'Linh hồn bị giam cầm trong sự u uất, chịu nỗi đau lặp đi lặp lại của việc tự tử mà không thể đầu thai.',
    advice: 'Thân người khó được. Khi khổ đau, hãy tìm đến người thân, bạn bè, thầy cô hay chuyên gia để được lắng nghe và giúp đỡ.' },
  { n: 15, name: 'Trách Trai Địa Ngục', short: 'TRÁCH TRAI', meaning: 'Ngục phanh thây',
    sin: 'Kẻ đào mộ, trộm cắp quan tài, phá hoại nơi an nghỉ của người chết.',
    punish: 'Bị quỷ dùng cưa phanh thây thành nhiều mảnh.',
    advice: 'Tôn kính người đã khuất, gìn giữ mồ mả, nơi an nghỉ.' },
  { n: 16, name: 'Hỏa Diệm Địa Ngục', short: 'HỎA DIỆM', meaning: 'Ngục lửa thiêu',
    sin: 'Kẻ tham nhũng, ăn hối lộ, lừa đảo chiếm đoạt tài sản công.',
    punish: 'Bị tống vào lò lửa lớn thiêu đốt liên tục.',
    advice: 'Liêm chính, chí công vô tư; của công phải giữ như giữ của mình.' },
  { n: 17, name: 'Thạch Bàn Địa Ngục', short: 'THẠCH BÀN', meaning: 'Ngục cối đá xay',
    sin: 'Kẻ đè nén, bóc lột dân nghèo, buôn gian bán lận.',
    punish: 'Bị ép vào cối đá xay thịt nghiền thành bột cám.',
    advice: 'Làm ăn lương thiện, chia sẻ với người nghèo khó.' },
  { n: 18, name: 'Đao Cư Địa Ngục', short: 'ĐAO CƯ', meaning: 'Ngục cưa xẻ',
    sin: 'Kẻ buôn bán bất chính, dùng cân điêu gian lận, lừa gạt phụ nữ và trẻ em.',
    punish: 'Linh hồn bị trói vào cột và dùng cưa sắt xẻ dọc từ trên đầu xuống.',
    advice: 'Cân đủ, đong đầy, buôn bán thật thà; không lừa người yếu thế.' }
];

export interface Arhat {
  n: number;
  name: string;       // Tên Việt
  short: string;      // Tên ngắn khắc trên biển
  sanskrit: string;   // Tên Phạn
  phonetic: string;   // Phiên âm Hán Việt
  desc: string;
}

export const ARHATS: Arhat[] = [
  { n: 1, name: 'Tọa Lộc La Hán', short: 'TỌA LỘC', sanskrit: 'Pindola Bharadvaja', phonetic: 'Tân-đầu-lô-phả-đọa',
    desc: 'Hình tướng ngài ngồi trên lưng một con hươu một cách ung dung, tự tại.' },
  { n: 2, name: 'Khánh Hỷ La Hán', short: 'KHÁNH HỶ', sanskrit: 'Kanakavatsa', phonetic: 'Ca-nặc-ca-phạt-tha',
    desc: 'Vị La Hán luôn mang nụ cười hoan hỷ, tươi vui biểu thị cho cái tâm bình an.' },
  { n: 3, name: 'Cử Bát La Hán', short: 'CỬ BÁT', sanskrit: 'Kanakabharadvaja', phonetic: 'Ca-nặc-ca-bạt-ly-đọa',
    desc: 'Ngài thường được khắc họa với tư thế giơ cao chiếc bát hành khất ngang đầu.' },
  { n: 4, name: 'Thác Tháp La Hán', short: 'THÁC THÁP', sanskrit: 'Subinda', phonetic: 'Tô-tần-đà',
    desc: 'Ngài nâng một chiếc bảo tháp nhỏ trong lòng bàn tay để nhắc nhở Chánh pháp luôn hiện hữu.' },
  { n: 5, name: 'Tĩnh Tọa La Hán', short: 'TĨNH TỌA', sanskrit: 'Nakula', phonetic: 'Nặc-cự-la',
    desc: 'Hình tượng ngồi thiền tĩnh lặng, tượng trưng cho việc buông bỏ bạo lực để tu tập nội tâm.' },
  { n: 6, name: 'Quá Giang La Hán', short: 'QUÁ GIANG', sanskrit: 'Bhadra', phonetic: 'Bạt-đà-la',
    desc: 'Vị La Hán gắn liền với tích vượt sông dũng cảm để đi truyền bá Phật pháp.' },
  { n: 7, name: 'Kỵ Tượng La Hán', short: 'KỴ TƯỢNG', sanskrit: 'Kalika', phonetic: 'Ca-lý-ca',
    desc: 'Ngài ngồi thiền bình an trên lưng một chú voi to lớn mà ngài đã cảm hóa.' },
  { n: 8, name: 'Tiếu Sư La Hán', short: 'TIẾU SƯ', sanskrit: 'Vajraputra', phonetic: 'Phạt-xà-la-phất-đa-la',
    desc: 'Còn gọi là La Hán đùa với sư tử, ngài mạnh mẽ, tráng kiện và thường đi cùng một chú sư tử nhỏ.' },
  { n: 9, name: 'Khai Tâm La Hán', short: 'KHAI TÂM', sanskrit: 'Jivaka', phonetic: 'Nhung-bác-ca',
    desc: 'Ngài được khắc họa với tư thế vạch áo ngực để hiển lộ hình ảnh Phật ở trong tâm.' },
  { n: 10, name: 'Thám Thủ La Hán', short: 'THÁM THỦ', sanskrit: 'Panthaka', phonetic: 'Bán-thác-ca',
    desc: 'Ngài thường được tạc tượng với tư thế vươn hai tay lên cao, duỗi người thoải mái sau khi xả thiền.' },
  { n: 11, name: 'Trầm Tư La Hán', short: 'TRẦM TƯ', sanskrit: 'Rahula', phonetic: 'La-hỗ-la',
    desc: 'Ngài chính là con trai của Đức Phật Thích Ca trước khi ngài xuất gia. Tượng ngài thường ngồi cúi đầu chầm chậm ngẫm nghĩ trong định sâu.' },
  { n: 12, name: 'Khoái Nhĩ La Hán', short: 'KHOÁI NHĨ', sanskrit: 'Nagasena', phonetic: 'Na-già-tê-na',
    desc: 'Vị La Hán có biểu cảm vô cùng thư thái, tay cầm một chiếc que nhỏ đang ở tư thế ngoáy tai.' },
  { n: 13, name: 'Bố Đại La Hán', short: 'BỐ ĐẠI', sanskrit: 'Angada', phonetic: 'Nhân-kiệt-đà',
    desc: 'Ngài vốn là người bắt rắn độc bẻ răng rồi thả về rừng để cứu người, luôn mang theo một chiếc túi vải lớn sau lưng.' },
  { n: 14, name: 'Ba Tiêu La Hán', short: 'BA TIÊU', sanskrit: 'Vanavasin', phonetic: 'Phạt-na-bà-tư',
    desc: 'Ngài sinh ra dưới mưa rừng, sau khi đắc đạo thường thích tĩnh tọa thiền định dưới gốc cây chuối rừng.' },
  { n: 15, name: 'Trường Mi La Hán', short: 'TRƯỜNG MI', sanskrit: 'Ajita', phonetic: 'A-thị-đa',
    desc: 'Điểm đặc trưng nhất của ngài là có đôi lông mi rất dài rủ xuống, biểu thị cho sự trường thọ và trí tuệ sâu dày.' },
  { n: 16, name: 'Kháng Môn La Hán', short: 'KHÁNG MÔN', sanskrit: 'Cullapatka', phonetic: 'Trú-trà-bán-thác-ca',
    desc: 'Vị La Hán cầm một cây tích trượng có những chiếc vòng rung lên để thông báo khi đi khất thực thay vì gõ cửa nhà dân.' },
  { n: 17, name: 'Hàng Long La Hán', short: 'HÀNG LONG', sanskrit: 'Nandimitra', phonetic: 'Khánh-hữu',
    desc: 'Vị La Hán thứ 17 được thêm vào với hình ảnh dũng mãnh đang thuần phục một con rồng lớn.' },
  { n: 18, name: 'Phục Hổ La Hán', short: 'PHỤC HỔ', sanskrit: 'Dharmatrata', phonetic: 'Tân-đầu-lô',
    desc: 'Vị La Hán thứ 18, thường đi kèm hình ảnh một con hổ dữ đã được ngài thuần hóa bằng lòng từ bi.' }
];

const INFO: Record<string, InfoContent> = {
  'hell-0': {
    title: 'Luật Nhân Quả',
    subtitle: 'Gieo nhân nào, gặt quả nấy',
    body: 'Mười tám tầng địa ngục là hình ảnh răn dạy trong văn hoá Phật giáo dân gian: mỗi việc ác đều để lại quả báo tương ứng. Hãy đi hết ba hành lang, đọc từng tầng để tự soi lại mình, rồi đến điện Địa Tạng Bồ Tát ở cuối hang để sám hối và phát nguyện làm lành.'
  },
  'hell-19': {
    title: 'Địa Tạng Vương Bồ Tát',
    subtitle: '"Địa ngục vị không, thệ bất thành Phật"',
    body: 'Ngài phát đại nguyện: chừng nào địa ngục còn chúng sinh thì Ngài chưa thành Phật. Biết lỗi mà sám hối, phát nguyện dứt ác làm lành, thì nghiệp xấu dần chuyển hoá. Hãy thắp hương, lễ lạy và bấm "Sám hối" trước tượng Ngài.'
  },
  'pagoda-guanyin': {
    title: 'Quán Thế Âm Bồ Tát Thiên Thủ Thiên Nhãn',
    subtitle: 'Nghìn tay nghìn mắt',
    body: 'Nghìn mắt để thấy hết nỗi khổ của chúng sinh, nghìn tay để cứu giúp khắp nơi. Pho tượng ở đây có đúng một nghìn cánh tay, mỗi lòng bàn tay có một con mắt; bốn mươi hai tay lớn cầm pháp khí, trên đỉnh đầu xếp tầng các khuôn mặt từ bi.'
  },
  'pagoda-tower': {
    title: 'Bảo Tháp',
    subtitle: 'Tháp bảy tầng và vườn tháp',
    body: 'Bảo tháp bảy tầng là nơi tôn thờ Xá Lợi. Hai bên sân là vườn tháp mộ của chư Tổ, chư Tăng đời trước. Đi nhiễu quanh tháp, chắp tay niệm Phật là một cách tu tập tịnh tâm.'
  },
  'arhat-0': {
    title: 'La Hán Đường',
    subtitle: 'Thập bát La Hán',
    body: 'Mười tám vị A-la-hán là các đệ tử của Đức Phật, đã dứt sạch phiền não và phát nguyện ở lại thế gian hộ trì Chánh pháp. Hãy đi dọc vách bên trái từ vị thứ 1 đến vị thứ 9, rồi sang vách bên phải từ vị thứ 10 về tới vị thứ 18. Đứng gần mỗi pho tượng để đọc tích của ngài.'
  }
};

export function getInfo(id: string): InfoContent | null {
  const a = /^arhat-(\d+)$/.exec(id);
  if (a && Number(a[1]) > 0) {
    const A = ARHATS[Number(a[1]) - 1];
    if (A) return { title: `${A.n}. ${A.name}`, subtitle: `${A.sanskrit} · ${A.phonetic}`, body: A.desc };
  }
  const m = /^hell-(\d+)$/.exec(id);
  if (m) {
    const n = Number(m[1]);
    const L = HELL_LEVELS[n - 1];
    if (L) {
      return {
        title: `Tầng ${L.n}: ${L.name}`,
        subtitle: L.meaning,
        sin: L.sin,
        punish: L.punish,
        advice: L.advice,
        note: L.n === 14 ? 'Nếu bạn đang thấy bế tắc, đừng ở một mình với nỗi buồn: hãy nói chuyện với người bạn tin tưởng hoặc tìm đến chuyên gia tâm lý. Mạng sống của bạn rất quý giá.' : undefined
      };
    }
  }
  return INFO[id] || null;
}
