BILLING_SYSTEM_PROMPT = """
You are a hotel AI concierge generating a natural-language billing summary for a guest.
You will receive structured billing JSON data and must respond in the guest's language.

Rules:
- Be polite and professional, matching a 5-star hotel tone.
- Format amounts in both KRW and USD according to the guest's language:
  - For Korean: "금액원 ($금액)" (e.g., 50,000원 ($38.50))
  - For English/others: "$금액 (금액원)" (e.g., $38.50 (50,000원))
- Always mention: subtotal, tax (10%), service charge (10%), and total amount.
- If a specific category was filtered, mention it clearly (e.g., "룸서비스 이용 내역").
- List individual items concisely.
- Do NOT invent any amounts or items not present in the data.
- Output ONLY the guest reply text. No JSON, no extra formatting.
""".strip()


def build_billing_prompt(billing_data: dict, language: str) -> str:
    category = billing_data.get("category", "ALL")
    items = billing_data.get("items", [])
    
    subtotal_krw = billing_data.get("subtotalKrw", billing_data.get("subtotal", 0))
    subtotal_usd = billing_data.get("subtotalUsd", billing_data.get("subtotal", 0) / 1350.0)
    
    tax_krw = billing_data.get("taxKrw", billing_data.get("tax", 0))
    tax_usd = billing_data.get("taxUsd", billing_data.get("tax", 0) / 1350.0)
    
    service_charge_krw = billing_data.get("serviceChargeKrw", billing_data.get("serviceCharge", 0))
    service_charge_usd = billing_data.get("serviceChargeUsd", billing_data.get("serviceCharge", 0) / 1350.0)
    
    total_krw = billing_data.get("totalAmountKrw", billing_data.get("totalAmount", 0))
    total_usd = billing_data.get("totalAmountUsd", billing_data.get("totalAmount", 0) / 1350.0)
    
    room_no = billing_data.get("roomNo", "")
    category_label = "전체" if category == "ALL" else category

    if language == "ko":
        items_text = "\n".join(
            f"  - {item['menuName']} x{item['quantity']}: {int(item.get('totalPriceKrw', item['totalPrice'])):,}원 (${item.get('totalPriceUsd', item['totalPrice']/1350.0):.2f})"
            for item in items
        )
        return (
            f"{room_no}호 객실 {category_label} 이용 내역을 아래와 같이 안내드립니다:\n\n"
            f"{items_text}\n\n"
            f"소계: {int(subtotal_krw):,}원 (${subtotal_usd:.2f})\n"
            f"부가세 (10%): {int(tax_krw):,}원 (${tax_usd:.2f})\n"
            f"봉사료 (10%): {int(service_charge_krw):,}원 (${service_charge_usd:.2f})\n"
            f"최종 결제 예정 금액: {int(total_krw):,}원 (${total_usd:.2f})\n\n"
            f"위 금액은 체크아웃 시 일괄 정산됩니다. 추가 문의사항은 프론트 데스크로 연락 주세요."
        )
    else:
        items_text = "\n".join(
            f"  - {item['menuName']} x{item['quantity']}: ${item.get('totalPriceUsd', item['totalPrice']/1350.0):.2f} ({int(item.get('totalPriceKrw', item['totalPrice'])):,}원)"
            for item in items
        )
        return (
            f"Here is your billing summary for room {room_no} ({category_label}):\n\n"
            f"{items_text}\n\n"
            f"Subtotal: ${subtotal_usd:.2f} ({int(subtotal_krw):,}원)\n"
            f"Tax (10%): ${tax_usd:.2f} ({int(tax_krw):,}원)\n"
            f"Service Charge (10%): ${service_charge_usd:.2f} ({int(service_charge_krw):,}원)\n"
            f"Total Amount Due: ${total_usd:.2f} ({int(total_krw):,}원)\n\n"
            f"The above amount will be settled at checkout. For further inquiries, please contact the front desk."
        )
