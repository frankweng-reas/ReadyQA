import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 開始種子資料...');

  // 1. 建立方案 (Plans)
  const plans = [
    {
      code: 'free',
      name: '免費方案',
      maxChatbots: 1,
      maxFaqsPerBot: 50,
      maxQueriesPerMo: 1000,
      enableAnalytics: false,
      enableApi: false,
      enableExport: false,
      priceUsdMonthly: 0,
      priceTwdMonthly: 0,
      currencyDefault: 'TWD',
    },
    {
      code: 'starter',
      name: '入門方案',
      maxChatbots: 3,
      maxFaqsPerBot: 200,
      maxQueriesPerMo: 5000,
      enableAnalytics: true,
      enableApi: false,
      enableExport: true,
      priceUsdMonthly: 29.99,
      priceTwdMonthly: 900,
      currencyDefault: 'TWD',
    },
    {
      code: 'pro',
      name: '專業方案',
      maxChatbots: 10,
      maxFaqsPerBot: 1000,
      maxQueriesPerMo: 20000,
      enableAnalytics: true,
      enableApi: true,
      enableExport: true,
      priceUsdMonthly: 99.99,
      priceTwdMonthly: 2990,
      currencyDefault: 'TWD',
    },
    {
      code: 'enterprise',
      name: '企業方案',
      maxChatbots: null,
      maxFaqsPerBot: null,
      maxQueriesPerMo: null,
      enableAnalytics: true,
      enableApi: true,
      enableExport: true,
      priceUsdMonthly: 299.99,
      priceTwdMonthly: 8990,
      currencyDefault: 'TWD',
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
    console.log(`✅ 建立方案: ${plan.name}`);
  }

  // 2. 建立測試租戶
  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-demo' },
    update: {},
    create: {
      id: 'tenant-demo',
      name: 'Demo Company',
      planCode: 'pro',
      status: 'active',
    },
  });
  console.log(`✅ 建立租戶: ${tenant.name}`);

  // 3. 建立測試用戶
  const user = await prisma.user.upsert({
    where: { email: 'demo@qaplus.com' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@qaplus.com',
      isActive: true,
      tenantId: tenant.id,
    },
  });
  console.log(`✅ 建立用戶: ${user.username}`);

  // 4. 建立測試 Chatbot
  const chatbot = await prisma.chatbot.upsert({
    where: { id: 'chatbot-demo' },
    update: {},
    create: {
      id: 'chatbot-demo',
      userId: user.id,
      tenantId: tenant.id,
      name: 'Demo 客服機器人',
      description: '這是一個示範用的客服機器人',
      status: 'published',
      isActive: 'active',
      theme: {
        primaryColor: '#3B82F6',
        fontFamily: 'Inter',
      },
      domainWhitelist: ['localhost', 'qaplus.com'],
    },
  });
  console.log(`✅ 建立 Chatbot: ${chatbot.name}`);

  // 5. 建立測試 Topic
  const topic = await prisma.topic.upsert({
    where: { id: 'topic-general' },
    update: {},
    create: {
      id: 'topic-general',
      chatbotId: chatbot.id,
      name: '一般問題',
      description: '常見問題',
      sortOrder: 1,
    },
  });
  console.log(`✅ 建立 Topic: ${topic.name}`);

  // 6. 建立幾個測試 FAQ
  const faqs = [
    {
      id: 'faq-1',
      chatbotId: chatbot.id,
      topicId: topic.id,
      question: '如何註冊帳號？',
      answer: '請點擊右上角的「註冊」按鈕，填寫您的 Email 和密碼即可完成註冊。',
      synonym: '註冊,register,sign up',
      status: 'active',
      layout: 'text',
    },
    {
      id: 'faq-2',
      chatbotId: chatbot.id,
      topicId: topic.id,
      question: '忘記密碼怎麼辦？',
      answer: '請點擊登入頁面的「忘記密碼」連結，輸入您的 Email，我們會寄送重設密碼的連結給您。',
      synonym: '密碼,password,forget',
      status: 'active',
      layout: 'text',
    },
    {
      id: 'faq-3',
      chatbotId: chatbot.id,
      topicId: topic.id,
      question: '支援哪些付款方式？',
      answer: '我們支援信用卡、LINE Pay、街口支付等多種付款方式。',
      synonym: '付款,payment,pay',
      status: 'active',
      layout: 'text',
    },
  ];

  for (const faq of faqs) {
    await prisma.faq.upsert({
      where: { id: faq.id },
      update: {},
      create: faq,
    });
    console.log(`✅ 建立 FAQ: ${faq.question}`);
  }

  console.log('🎉 種子資料建立完成！');
}

main()
  .catch((e) => {
    console.error('❌ 種子資料建立失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

