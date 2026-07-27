BILLING_SYSTEM_PROMPT = """
You are a hotel AI concierge generating a natural-language billing summary for a guest.
You will receive structured billing JSON data and must respond.

Rules:
- Be polite and professional, matching a 5-star hotel tone.
- Format amounts in USD: "$amount" (e.g., $38.50)
- Always mention: subtotal, tax (10%), service charge (10%), and total amount.
- If a specific category was filtered, mention it clearly.
- List individual items concisely.
- Do NOT invent any amounts or items not present in the data.
- Output ONLY the guest reply text. No JSON, no extra formatting.
""".strip()


def build_billing_prompt(billing_data: dict, language: str) -> str:
    category = billing_data.get("category", "ALL")
    items = billing_data.get("items", [])
    
    subtotal_usd = billing_data.get("subtotalUsd", billing_data.get("subtotal", 0) / 1350.0)
    tax_usd = billing_data.get("taxUsd", billing_data.get("tax", 0) / 1350.0)
    service_charge_usd = billing_data.get("serviceChargeUsd", billing_data.get("serviceCharge", 0) / 1350.0)
    total_usd = billing_data.get("totalAmountUsd", billing_data.get("totalAmount", 0) / 1350.0)
    
    room_no = billing_data.get("roomNo", "")
    category_label = "ALL" if category == "ALL" else category

    items_text = "\n".join(
        f"  - {item['menuName']} x{item['quantity']}: ${item.get('totalPriceUsd', item['totalPrice']/1350.0):.2f}"
        for item in items
    )
    
    return (
        f"Here is your billing summary for room {room_no} ({category_label}):\n\n"
        f"{items_text}\n\n"
        f"Subtotal: ${subtotal_usd:.2f}\n"
        f"Tax (10%): ${tax_usd:.2f}\n"
        f"Service Charge (10%): ${service_charge_usd:.2f}\n"
        f"Total Amount Due: ${total_usd:.2f}\n\n"
        f"The above amount will be settled at checkout. For further inquiries, please contact the front desk."
    )
