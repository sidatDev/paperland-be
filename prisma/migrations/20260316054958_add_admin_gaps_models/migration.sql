-- CreateTable
CREATE TABLE "flash_sales" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "banner_image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_sale_items" (
    "id" TEXT NOT NULL,
    "flash_sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sale_price" DECIMAL(10,2) NOT NULL,
    "stock_limit" INTEGER,
    "sold_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flash_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_programs" (
    "id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reward_amount" DECIMAL(10,2) NOT NULL,
    "min_order_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_referrals" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reward_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cnic" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Karachi',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_call_logs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "call_type" TEXT NOT NULL DEFAULT 'PRE_DISPATCH',
    "outcome" TEXT,
    "notes" TEXT,
    "called_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_deposits" (
    "id" TEXT NOT NULL,
    "b2b_profile_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "deposit_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "receipt_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flash_sale_items_flash_sale_id_product_id_key" ON "flash_sale_items"("flash_sale_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_referrals_referral_code_key" ON "customer_referrals"("referral_code");

-- CreateIndex
CREATE INDEX "customer_referrals_referrer_id_idx" ON "customer_referrals"("referrer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_agents_cnic_key" ON "delivery_agents"("cnic");

-- CreateIndex
CREATE INDEX "order_call_logs_order_id_idx" ON "order_call_logs"("order_id");

-- CreateIndex
CREATE INDEX "security_deposits_b2b_profile_id_idx" ON "security_deposits"("b2b_profile_id");

-- AddForeignKey
ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_flash_sale_id_fkey" FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "referral_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_call_logs" ADD CONSTRAINT "order_call_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_b2b_profile_id_fkey" FOREIGN KEY ("b2b_profile_id") REFERENCES "b2b_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
