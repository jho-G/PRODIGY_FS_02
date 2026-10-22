"""
Signals for the employees application.

Automatically provisions and maintains an ADMIN UserProfile whenever a superuser
is created or updated (e.g., via `createsuperuser`).
"""

from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=User)
def create_or_update_superuser_profile(sender, instance, created, **kwargs):
    """
    Ensure every Django superuser has an associated ADMIN UserProfile.
    Standard non-superuser accounts are provisioned via the admin panel
    or explicitly linked by application logic.
    """
    if instance.is_superuser:
        profile, created_profile = UserProfile.objects.get_or_create(
            user=instance,
            defaults={"role": "ADMIN"},
        )
        if not created_profile and profile.role != "ADMIN":
            profile.role = "ADMIN"
            profile.save(update_fields=["role"])
