from django.shortcuts import render
from django.http import JsonResponse
import secrets
import string

def home(request):
    return render(request, 'generator/index.html')

def generate_password(request):
    try:
        length = int(request.GET.get('length', 12))
        length = max(8, min(128, length))
    except ValueError:
        length = 12

    try:
        count = int(request.GET.get('count', 1))
        count = max(1, min(10, count))
    except ValueError:
        count = 1

    use_uppercase    = request.GET.get('uppercase')    == 'true'
    use_lowercase    = request.GET.get('lowercase')    == 'true'
    use_numbers      = request.GET.get('numbers')      == 'true'
    use_symbols      = request.GET.get('symbols')      == 'true'
    exclude_ambiguous = request.GET.get('no_ambiguous') == 'true'
    custom_name       = request.GET.get('name', '').strip()

    AMBIGUOUS = set('0Ol1I|`')

    characters = ''
    if use_uppercase: characters += string.ascii_uppercase
    if use_lowercase: characters += string.ascii_lowercase
    if use_numbers:   characters += string.digits
    if use_symbols:   characters += string.punctuation

    if exclude_ambiguous:
        characters = ''.join(c for c in characters if c not in AMBIGUOUS)

    if not characters:
        return JsonResponse({'error': 'Please select at least one character type'}, status=400)

    def build_password():
        if custom_name:
            # Ensure password is at least as long as the name
            effective_length = max(length, len(custom_name))
            pad_length = effective_length - len(custom_name)
            padding = [secrets.choice(characters) for _ in range(pad_length)]
            # Insert name at a random position within the padding
            insert_pos = secrets.randbelow(pad_length + 1) if pad_length > 0 else 0
            result = padding[:insert_pos] + list(custom_name) + padding[insert_pos:]
            return ''.join(result)
        else:
            return ''.join(secrets.choice(characters) for _ in range(length))

    passwords = [build_password() for _ in range(count)]
    return JsonResponse({'passwords': passwords})
