-- CreateTable
CREATE TABLE "kb_feedback" (
    "id" TEXT NOT NULL,
    "article_id" TEXT,
    "faq_id" TEXT,
    "helpful" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_feedback_article_id_idx" ON "kb_feedback"("article_id");

-- CreateIndex
CREATE INDEX "kb_feedback_faq_id_idx" ON "kb_feedback"("faq_id");

-- AddForeignKey
ALTER TABLE "kb_feedback" ADD CONSTRAINT "kb_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_feedback" ADD CONSTRAINT "kb_feedback_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "kb_faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
