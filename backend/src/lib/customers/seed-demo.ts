import {
  FulfillmentType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const ORDER_PREFIX = "CUS-";

const REGISTERED = [
  { name: "Ahmed Raza Malik", email: "ahmed.raza@demo.restaurant", phone: "+92 321 4488291" },
  { name: "Sana Javed", email: "sana.javed@demo.restaurant", phone: "0334-5566778" },
  { name: "Usman Tariq", email: "usman.tariq@demo.restaurant", phone: "923455667799" },
  { name: "Hina Sheikh", email: "hina.sheikh@demo.restaurant", phone: "0301-8823344" },
  { name: "Bilal Qureshi", email: "bilal.q@demo.restaurant", phone: "0345 9911223" },
  { name: "Mehwish Khan", email: "mehwish.k@demo.restaurant", phone: "0321-7744556" },
  { name: "Faisal Iqbal", email: "faisal.i@demo.restaurant", phone: "0300-6677889" },
  { name: "Rabia Noor", email: "rabia.noor@demo.restaurant", phone: "+92 300 5566123" },
];

const GUEST_ONLY: { name: string; phone: string; email: string | null }[] = [
  { name: "Zainab Hussain", phone: "0307-2211456", email: "zainab.h@demo.local" },
  { name: "Hamza Siddiqui", phone: "0312 8899001", email: null },
  { name: "Ayesha Bano", phone: "+92 333 4455667", email: "ayesha.b@demo.local" },
  { name: "Kamran Butt", phone: "0341-7788990", email: null },
  { name: "Nida Farooq", phone: "0300-3344556", email: "nida.f@demo.local" },
  { name: "Saad Mahmood", phone: "923018889977", email: null },
  { name: "Maryam Akhtar", phone: "0322-5566778", email: "maryam.a@demo.local" },
  { name: "Imran Khattak", phone: "0305-1122334", email: null },
  { name: "Sadia Mirza", phone: "0333-9988776", email: "sadia.m@demo.local" },
  { name: "Waqas Gill", phone: "0344-2211335", email: null },
  { name: "Laiba Shah", phone: "0302-6677881", email: "laiba.s@demo.local" },
  { name: "Tariq Mehmood", phone: "0311-4455660", email: null },
  { name: "Hira Aslam", phone: "+92 345 1122334", email: "hira.a@demo.local" },
  { name: "Danish Ali", phone: "0308-9900112", email: null },
  { name: "Kiran Yousaf", phone: "0320-7788456", email: "kiran.y@demo.local" },
  { name: "Noman Chaudhry", phone: "0331-5566009", email: null },
  { name: "Amna Rafiq", phone: "0304-2233445", email: "amna.r@demo.local" },
  { name: "Shahzaib Khan", phone: "0342-8877665", email: null },
  { name: "Eman Saleem", phone: "0309-5544332", email: "eman.s@demo.local" },
  { name: "Junaid Akram", phone: "0315-6677001", email: null },
  { name: "Palwasha Jan", phone: "0325-1122998", email: "palwasha.j@demo.local" },
  { name: "Rehan Masood", phone: "0306-8899771", email: null },
  { name: "Sumbul Haider", phone: "0335-4455889", email: "sumbul.h@demo.local" },
  { name: "Asim Farhan", phone: "0340-3322110", email: null },
  { name: "Mahnoor Tariq", phone: "0303-7766554", email: "mahnoor.t@demo.local" },
  { name: "Omer Hayat", phone: "0318-9900443", email: null },
  { name: "Rida Batool", phone: "0327-2211445", email: "rida.b@demo.local" },
  { name: "Hassan Javed", phone: "0330-5566771", email: null },
  { name: "Alina Qazi", phone: "0301-9988770", email: "alina.q@demo.local" },
  { name: "Zeeshan Anwar", phone: "0346-1122339", email: null },
  { name: "Fatima Zahra", phone: "0313-4455662", email: "fatima.z@demo.local" },
  { name: "Arslan Haider", phone: "0324-8877003", email: null },
  { name: "Nimra Saleem", phone: "0300-5544338", email: "nimra.s@demo.local" },
  { name: "Yasir Mehmood", phone: "0332-6677884", email: null },
  { name: "Hafsa Riaz", phone: "0343-2211556", email: "hafsa.r@demo.local" },
  { name: "Adnan Sheikh", phone: "0310-8899007", email: null },
  { name: "Saba Imtiaz", phone: "0326-3344550", email: "saba.i@demo.local" },
  { name: "Fahad Mir", phone: "0307-1122448", email: null },
  { name: "Qurat ul Ain", phone: "0336-7788992", email: "qurat.a@demo.local" },
  { name: "Mubashir Ali", phone: "0347-5566110", email: null },
  { name: "Iqra Hanif", phone: "0314-9900116", email: "iqra.h@demo.local" },
  { name: "Waleed Chishti", phone: "0328-4455773", email: null },
  { name: "Samina Kosar", phone: "0305-6677882", email: "samina.k@demo.local" },
  { name: "Khurram Shahzad", phone: "0337-2211004", email: null },
  { name: "Anum Liaqat", phone: "0348-8899775", email: "anum.l@demo.local" },
  { name: "Babar Azam", phone: "0316-1122337", email: null },
  { name: "Tehmina Bukhari", phone: "0329-5566441", email: "tehmina.b@demo.local" },
  { name: "Salman Haider", phone: "0308-3344668", email: null },
  { name: "Rukhsana Begum", phone: "0338-7788123", email: "rukhsana.b@demo.local" },
  { name: "Javed Iqbal", phone: "0349-9900556", email: null },
  { name: "Noreen Akhtar", phone: "0317-4455880", email: "noreen.a@demo.local" },
  { name: "Shoaib Malik", phone: "0323-6677991", email: null },
];

function atDayOffset(daysAgo: number, hour: number, minute: number) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function orderCountForIndex(i: number): number {
  if (i < 38) return 1 + (i % 2);
  if (i < 52) return 3 + (i % 3);
  return 8 + (i % 8);
}

function lastOrderDaysAgo(i: number): number {
  if (i % 11 === 0) return 65 + (i % 20);
  if (i % 7 === 0) return 35 + (i % 10);
  if (i % 5 === 0) return 5 + (i % 12);
  return i % 28;
}

function joinedDaysAgo(i: number, orders: number): number {
  return lastOrderDaysAgo(i) + 7 + orders * 3 + (i % 9);
}

export async function seedCustomersDemo(
  prisma: PrismaClient,
  branchId: string,
  riderId?: string | null
): Promise<{ created: number; registered: number }> {
  const existing = await prisma.order.findMany({
    where: { orderNumber: { startsWith: ORDER_PREFIX } },
    select: { id: true },
  });
  if (existing.length) {
    await prisma.orderFeedback.deleteMany({ where: { orderId: { in: existing.map((o) => o.id) } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: existing.map((o) => o.id) } } });
    await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    select: { id: true, name: true, price: true },
    take: 20,
  });
  if (menuItems.length < 2) return { created: 0, registered: 0 };

  const hash = await bcrypt.hash("demo-customer-seed", 10);
  const registeredUsers: { id: string; phone: string | null }[] = [];
  for (const person of REGISTERED) {
    const createdAt = atDayOffset(joinedDaysAgo(registeredUsers.length, 4), 10, 0);
    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: {
        name: person.name,
        email: person.email,
        passwordHash: hash,
        role: Role.CUSTOMER,
        phone: person.phone,
        createdAt,
      },
      update: { name: person.name, phone: person.phone },
    });
    registeredUsers.push({ id: user.id, phone: user.phone });
  }

  const profiles = [
    ...REGISTERED.map((r) => ({ name: r.name, phone: r.phone, email: r.email, registered: true })),
    ...GUEST_ONLY.map((g) => ({ ...g, registered: false })),
  ];

  let seq = 2000;
  let created = 0;

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    const orderCount = orderCountForIndex(i);
    const registeredUser = profile.registered ? registeredUsers[i] : undefined;

    for (let n = 0; n < orderCount; n++) {
      const daysAgo = lastOrderDaysAgo(i) + n * 4;
      const createdAt = atDayOffset(daysAgo, 12 + (n % 5), (i * 3 + n * 7) % 50);
      const item = menuItems[(i + n) % menuItems.length];
      const qty = 1 + ((i + n) % 2);
      const subtotal = Number(item.price) * qty;
      const status = n === 0 && i % 17 === 0 ? OrderStatus.CANCELLED : OrderStatus.DELIVERED;
      const total = subtotal + (i % 3 === 0 ? 120 : 0);

      seq += 1;
      await prisma.order.create({
        data: {
          orderNumber: `${ORDER_PREFIX}${seq}`,
          branchId,
          customerId: registeredUser?.id ?? null,
          riderId: status === OrderStatus.DELIVERED ? riderId ?? undefined : undefined,
          status,
          orderSource: n % 2 === 0 ? OrderSource.ONLINE : OrderSource.POS,
          fulfillmentType: i % 4 === 0 ? FulfillmentType.PICKUP : FulfillmentType.DELIVERY,
          paymentMethod: PaymentMethod.CASH,
          subtotal,
          deliveryCharge: i % 3 === 0 ? 120 : 0,
          total,
          deliveryAddress: `House ${10 + (i % 90)}, Demo Town`,
          customerName: profile.name,
          customerPhone: profile.phone,
          customerEmail: profile.email,
          createdAt,
          updatedAt: createdAt,
          items: {
            create: [
              {
                menuItemId: item.id,
                quantity: qty,
                priceAtOrder: item.price,
                nameAtOrder: item.name,
              },
            ],
          },
        },
      });
      created += 1;
    }
  }

  return { created, registered: registeredUsers.length };
}
