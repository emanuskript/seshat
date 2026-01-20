<script setup>
import { useTour } from '@/composables/useTour'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon/Icon.vue'

const {
  nextStep,
  prevStep,
  skipTour,
  isFirstStep,
  isLastStep,
  currentStep
} = useTour()

function handleNext() {
  if (currentStep.value?.onNext) {
    currentStep.value.onNext()
  }
  nextStep()
}

function handlePrev() {
  if (currentStep.value?.onPrev) {
    currentStep.value.onPrev()
  }
  prevStep()
}
</script>

<template>
  <div class="tour-navigation">
    <Button
      variant="ghost"
      size="sm"
      class="tour-navigation__skip"
      @click="skipTour"
    >
      Skip tour
    </Button>

    <div class="tour-navigation__buttons">
      <Button
        v-if="!isFirstStep"
        variant="outline"
        size="sm"
        @click="handlePrev"
      >
        <Icon name="chevron-left" :size="16" />
        Back
      </Button>

      <Button
        variant="default"
        size="sm"
        @click="handleNext"
      >
        {{ isLastStep ? 'Finish' : 'Next' }}
        <Icon v-if="!isLastStep" name="chevron-right" :size="16" />
        <Icon v-else name="check" :size="16" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.tour-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid hsl(var(--border));
}

.tour-navigation__skip {
  color: hsl(var(--muted-foreground));
}

.tour-navigation__skip:hover {
  color: hsl(var(--foreground));
}

.tour-navigation__buttons {
  display: flex;
  gap: 8px;
}
</style>
