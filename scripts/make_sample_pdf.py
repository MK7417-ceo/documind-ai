#!/usr/bin/env python3
"""Generate a sample PDF for testing DocuMind AI.

Creates a fictional "Acme Corp Refund & Shipping Policy" (~4 pages) with
concrete, specific facts so demo questions have real answers:

  - 30-day refund window from the delivery date
  - refund claims must be filed within 14 days of delivery
  - 10% restocking fee on opened items
  - support email: support@acme.example
  - standard shipping: 5-7 business days
  - 1-year warranty against manufacturing defects
  - a "risks" section (delays, damage, lost packages)

Usage:
    python scripts/make_sample_pdf.py [--out data/sample_docs/acme-refund-policy.pdf]
"""
from __future__ import annotations

import argparse
import os
import sys

from fpdf import FPDF

SECTIONS: list[tuple[str, str]] = [
    (
        "1. Introduction",
        "This document describes the official refund, shipping, and warranty "
        "policies of Acme Corp. Its purpose is to set clear expectations for "
        "customers before they place an order, and to give our support team a "
        "single source of truth when handling claims. These policies apply to "
        "all orders placed on the Acme Corp online store, unless a product page "
        "explicitly states otherwise. Acme Corp sells consumer electronics and "
        "home accessories directly to customers in more than forty countries. "
        "Because our catalog changes frequently, the policies in this document "
        "are reviewed every quarter by the operations team. The version you are "
        "reading was last updated in March 2026. If any statement in this "
        "document conflicts with a written agreement signed by an Acme Corp "
        "officer, the signed agreement takes precedence. Customers are "
        "encouraged to read the refund and shipping sections carefully before "
        "completing a purchase, since delivery times and return conditions "
        "vary by product category and destination country. For questions not "
        "covered here, contact our support team by email at "
        "support@acme.example and include your order number. We aim to answer "
        "every message within two business days. This introduction is "
        "intentionally detailed so that automated document assistants can be "
        "tested on summarization: the main purpose of this document is to "
        "define how refunds, shipping, warranties, and delivery risks are "
        "handled at Acme Corp.",
    ),
    (
        "2. Refund Policy",
        "Acme Corp offers a 30-day refund window. You may return any product "
        "within 30 days of the delivery date for a full refund of the purchase "
        "price. To start a return, file a refund claim within 14 days of "
        "delivery through your account page or by writing to "
        "support@acme.example with your order number and the reason for the "
        "return. Products must be unused and in their original packaging to "
        "qualify for a full refund. A 10% restocking fee applies to opened "
        "items that are returned in working condition. Items that arrive "
        "damaged or defective are exempt from the restocking fee; see the "
        "warranty section for details. Once your return is approved, the refund "
        "is issued to the original payment method within 5 to 7 business days. "
        "Shipping charges from the original order are refunded only when Acme "
        "Corp made an error, such as shipping the wrong item. Gift cards "
        "purchased from Acme Corp are non-refundable, but the remaining "
        "balance on a gift card never expires. If a refund claim is filed after "
        "the 14-day claim deadline, it will be reviewed case by case, and "
        "approval is not guaranteed. Customers who abuse the refund policy, "
        "for example by repeatedly returning used products, may have their "
        "accounts restricted. All refund decisions made by the support team are "
        "final, although customers may request one additional review by a team "
        "lead within 7 days of the decision.",
    ),
    (
        "3. Shipping Policy",
        "Acme Corp ships to most countries worldwide. Standard shipping takes "
        "5 to 7 business days after the order leaves our warehouse, and costs "
        "a flat 4.99 dollars. Orders over 99 dollars qualify for free standard "
        "shipping. Express shipping takes 2 to 3 business days and costs 12.99 "
        "dollars; it is available for most destinations but not for remote "
        "postal codes. International orders outside our primary markets take "
        "10 to 15 business days, and customs duties are calculated at "
        "checkout. Every order receives a tracking number by email within 24 "
        "hours of dispatch. If the tracking information has not updated for "
        "more than 5 business days, contact support@acme.example so we can "
        "open an investigation with the carrier. Delivery dates shown at "
        "checkout are estimates, not guarantees, especially during public "
        "holidays. Customers are responsible for providing a correct delivery "
        "address; redelivery fees for incorrect addresses are charged to the "
        "customer. Large furniture items are delivered by a scheduled freight "
        "service, and the customer will be contacted to book a delivery "
        "window. Signature confirmation is required for orders above 500 "
        "dollars.",
    ),
    (
        "4. Warranty and Delivery Risks",
        "Every Acme Corp product includes a 1-year warranty against "
        "manufacturing defects, counted from the delivery date. The warranty "
        "covers faulty components and assembly errors, but it does not cover "
        "accidental damage, normal wear, or unauthorized modifications. To "
        "make a warranty claim, write to support@acme.example with your order "
        "number, a description of the defect, and photos if applicable. "
        "Approved warranty claims are resolved by repair, replacement, or "
        "refund, at our discretion. Delivery involves risks that customers "
        "should understand. First, peak-season delays: during December, "
        "standard shipping can take up to 5 extra business days. Second, "
        "damage in transit: inspect your package on arrival and report visible "
        "damage within 48 hours, including photos of the box and the product. "
        "Third, lost packages: if tracking shows no movement for 10 business "
        "days, we open a carrier investigation and ship a replacement or "
        "issue a refund once the investigation closes. Fourth, weather "
        "disruptions: storms and natural events may delay shipments without "
        "prior notice, and such delays do not qualify for compensation beyond "
        "a refund of any express shipping fee paid. By placing an order, the "
        "customer acknowledges these risks.",
    ),
]


def create_sample_pdf(path: str) -> str:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_title("Acme Corp Refund & Shipping Policy")
    pdf.set_author("Acme Corp")

    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.multi_cell(0, 11, "Acme Corp - Refund & Shipping Policy", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(
        0,
        6,
        "Official customer policy document. Version March 2026. "
        "Covers refunds, shipping, warranty, and delivery risks.",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    for i, (title, body) in enumerate(SECTIONS):
        if i > 0:
            pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        pdf.set_font("Helvetica", "", 11)
        pdf.multi_cell(0, 7, body, new_x="LMARGIN", new_y="NEXT")

    pdf.output(path)
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the DocuMind AI sample PDF.")
    parser.add_argument(
        "--out",
        default=os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data",
            "sample_docs",
            "acme-refund-policy.pdf",
        ),
        help="Output path for the generated PDF.",
    )
    args = parser.parse_args()
    path = create_sample_pdf(args.out)
    print(f"Sample PDF written to {path}")


if __name__ == "__main__":
    sys.exit(main())
